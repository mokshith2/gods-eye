FROM python:3.9-slim
WORKDIR /app
RUN pip install --no-cache-dir requests schedule pandas FlightRadar24 pytz
COPY config/fetcher.py .
RUN mkdir -p /data
CMD ["python", "fetcher.py"]
