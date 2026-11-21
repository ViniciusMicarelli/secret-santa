FROM golang:1.27.4-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app ./cmd/api
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /app /app
CMD ["/app"]
