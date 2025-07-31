package signedurl

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"cloud.google.com/go/storage"
)

var (
	bucketName = "homework-assignments"
)

// Cloud Function entry point
func GenerateSignedURL(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	file := r.URL.Query().Get("file")

	if file == "" {
		http.Error(w, "Missing 'file' query parameter", http.StatusBadRequest)
		return
	}

	client, err := storage.NewClient(ctx)
	if err != nil {
		http.Error(w, "Failed to create storage client: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	url, err := generateV4GetObjectSignedURL(ctx, client, bucketName, file)
	if err != nil {
		http.Error(w, "Error generating signed URL: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": url})
}

func generateV4GetObjectSignedURL(ctx context.Context, client *storage.Client, bucket, object string) (string, error) {
	opts := &storage.SignedURLOptions{
		Scheme:         storage.SigningSchemeV4,
		Method:         "GET",
		Expires:        time.Now().Add(24 * time.Hour),
		GoogleAccessID: os.Getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
		PrivateKey:     []byte(os.Getenv("GOOGLE_SERVICE_ACCOUNT_KEY")),
	}

	return storage.SignedURL(bucket, object, opts)
}
