# VisionCare AI

AI-assisted diabetic retinopathy screening platform with ONNX inference, Eigen-CAM explainability, clinician review, dashboard analytics, and printable reports.

## Demo
- 10 fictional patients
- Demo account: admin@visioncare-demo.example.com / admin12345
- Demo reports include a FICTIONAL DATA watermark

## Run
cp .env.example .env
docker compose --env-file .env -f deployment/docker-compose.yml up -d --build

Open: http://localhost:3000

## Validation
- Backend tests: 44 passed
- Frontend production build: passed
- Model: dr-effb3-v1

## Medical Disclaimer
VisionCare AI is a screening-assistance project, not a diagnostic system. All AI outputs require clinician review.
