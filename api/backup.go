package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os/exec"
	"sync/atomic"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type BackupConfig struct {
	DatabaseURL     string
	S3Bucket        string
	BackupFrequency time.Duration
}

func doRegularBackup() {
	cfg := BackupConfig{
		DatabaseURL:     instance.DatabaseUrl,
		S3Bucket:        instance.S3Bucket,
		BackupFrequency: 7 * 24 * time.Hour,
	}
	fmt.Println("Performing periodic backups")
	// Run first backup immediately
	if err := performBackup(cfg); err != nil {
		log.Printf("Initial backup failed: %v", err)
	}

	// Set up periodic backups
	ticker := time.NewTicker(cfg.BackupFrequency)
	go func() {
		for range ticker.C {
			if err := performBackup(cfg); err != nil {
				log.Printf("Periodic backup failed: %v", err)
			}
		}
	}()

	// Keep main goroutine running
	select {}
}

// ProgressReader wraps an io.Reader and tracks bytes read
type ProgressReader struct {
	reader     io.Reader
	bytesRead  atomic.Int64
	lastUpdate time.Time
}

func NewProgressReader(reader io.Reader) *ProgressReader {
	fmt.Println("init progress reader")
	return &ProgressReader{
		reader:     reader,
		lastUpdate: time.Now(),
	}
}

func (pr *ProgressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	if n > 0 {
		pr.bytesRead.Add(int64(n))

		// Log progress every 5 seconds
		if time.Since(pr.lastUpdate) > 5*time.Second {
			mb := float64(pr.bytesRead.Load()) / 1024 / 1024
			log.Printf("Backup progress: %.2f MB uploaded", mb)
			pr.lastUpdate = time.Now()
		}
	}
	return n, err
}

func performBackup(cfg BackupConfig) error {
	log.Println("Starting backup...")
	ctx := context.Background()

	// Create pg_dump command
	cmd := exec.Command("pg_dump", cfg.DatabaseURL, "-Fc")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	log.Println("Running pg_dump...")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("pg_dump failed: %v: %s", err, stderr.String())
	}
	log.Printf("pg_dump complete, size: %.2f MB", float64(stdout.Len())/1024/1024)

	// Setup S3 client
	awsCfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return fmt.Errorf("failed to load AWS config: %w", err)
	}
	client := s3.NewFromConfig(awsCfg)

	// Prepare upload with progress reader
	dumpReader := bytes.NewReader(stdout.Bytes())

	timestamp := time.Now().Format("2006-01-02T15-04-05")
	key := fmt.Sprintf("%s.dump", timestamp)

	log.Println("Uploading to S3...")
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(cfg.S3Bucket),
		Key:    aws.String(key),
		Body:   dumpReader,
	})
	if err != nil {
		return fmt.Errorf("S3 upload failed: %w", err)
	}

	log.Printf("Backup completed successfully at %v", timestamp)
	return nil
}
