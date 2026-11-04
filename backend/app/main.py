
from fastapi import FastAPI

app = FastAPI(
    title="GPS Control API",
    description="API para la gestión y monitoreo de flotas vehiculares.",
    version="1.0.0",
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "message": "GPS Control API is running"
    }
