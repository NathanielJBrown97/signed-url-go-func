package signedurl

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/storage"
)

func GenerateSignedURL(w http.ResponseWriter, r *http.Request) {
	bucketName := "homework-assignments"
	objectName := r.URL.Query().Get("file")
	if objectName == "" {
		http.Error(w, "Missing 'file' query parameter", http.StatusBadRequest)
		return
	}

	keyJSONBase64 := os.Getenv("GCS_SA_KEY_JSON_BASE64")
	if keyJSONBase64 == "" {
		http.Error(w, "Missing GCS_SA_KEY_JSON_BASE64 environment variable", http.StatusInternalServerError)
		log.Println("GCS_SA_KEY_JSON_BASE64 is empty")
		return
	}

	keyJSONBytes, err := base64.StdEncoding.DecodeString(keyJSONBase64)
	if err != nil {
		http.Error(w, "Failed to decode service account key", http.StatusInternalServerError)
		log.Printf("Base64 decode error: %v", err)
		return
	}

	privateKey, googleAccessID, err := extractCredentials(keyJSONBytes)
	if err != nil {
		http.Error(w, "Failed to extract credentials", http.StatusInternalServerError)
		log.Printf("Credential extraction error: %v", err)
		return
	}

	url, err := storage.SignedURL(bucketName, objectName, &storage.SignedURLOptions{
		Method:         "GET",
		Expires:        time.Now().AddDate(0, 4, 0), //4 months
		GoogleAccessID: googleAccessID,
		PrivateKey:     privateKey,
	})
	if err != nil {
		http.Error(w, "Error generating signed URL", http.StatusInternalServerError)
		log.Printf("Error generating signed URL: %v", err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": url})
}

func extractCredentials(jsonBytes []byte) ([]byte, string, error) {
	var sa struct {
		PrivateKey  string `json:"private_key"`
		ClientEmail string `json:"client_email"`
	}
	if err := json.Unmarshal(jsonBytes, &sa); err != nil {
		return nil, "", fmt.Errorf("failed to parse key JSON: %w", err)
	}
	return []byte(sa.PrivateKey), sa.ClientEmail, nil
}
