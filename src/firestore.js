const Firestore = require('@google-cloud/firestore');

// GCP Secret
const GoogleApplicationCredentialPath = process.env.GOOGLE_APPLICATION_CREDENTIAL_PATH;
const GCPProjectId = process.env.GCP_PROJECT_ID;

// Create a firestore client
const db = new Firestore({
    projectId: GCPProjectId,
    keyFilename: GoogleApplicationCredentialPath,
});

module.exports = db;
