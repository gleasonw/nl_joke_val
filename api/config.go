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
		}
	})
}

func GetConfig() *AppConfig {
	if instance == nil {
		LoadConfig()
	}
	return instance
}
