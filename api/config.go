package main

import (
	"os"
	"sync"

	"github.com/joho/godotenv"
)

var (
	instance *AppConfig
	once     sync.Once
)

type AppConfig struct {
	ClientId     string
	ClientSecret string
	Nickname     string
	DatabaseUrl  string
	Debug        bool
	S3Bucket     string
}

func LoadConfig() {
	once.Do(func() {
		godotenv.Load()
		instance = &AppConfig{
			ClientId:     os.Getenv("CLIENT_ID"),
			ClientSecret: os.Getenv("CLIENT_SECRET"),
			Nickname:     os.Getenv("NICK"),
			DatabaseUrl:  os.Getenv("DATABASE_URL"),
			Debug:        os.Getenv("DEBUG") == "true",
			S3Bucket:     os.Getenv("AWS_S3_BUCKET"),
		}
	})
}

func GetConfig() *AppConfig {
	if instance == nil {
		LoadConfig()
	}
	return instance
}
