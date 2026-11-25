FROM mcr.microsoft.com/dotnet/sdk:10.0.302 AS build
WORKDIR /src
COPY . .
RUN dotnet restore services/rune/apps/rune-api/Rune.Api.csproj \
 && dotnet publish services/rune/apps/rune-api/Rune.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.10 AS runtime
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl fontconfig fonts-dejavu-core fonts-liberation imagemagick netcat-openbsd \
      poppler-utils python3 python3-brotli python3-fonttools tesseract-ocr nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --gid 10001 rune \
 && useradd --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin rune \
 && mkdir -p /data /cache /tmp/rune /app/assets \
 && chown -R 10001:10001 /data /cache /tmp/rune /app \
 && chmod 0770 /data /cache /tmp/rune
COPY --from=build /app/publish .
COPY services/rune/assets /app/assets
COPY services/rune/THIRD_PARTY_NOTICES.md /app/THIRD_PARTY_NOTICES.md
COPY services/rune/licenses /app/licenses
ENV ASPNETCORE_URLS=http://+:8080 \
    RUNE_DATA_ROOT=/data \
    RUNE_RENDER_CACHE_ROOT=/cache \
    RUNE_ASSET_ROOT=/app/assets \
    RUNE_SCHEMA_ROOT=/app/schemas \
    TMPDIR=/tmp/rune
STOPSIGNAL SIGTERM
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=4s --retries=12 CMD-SHELL curl --fail --silent http://localhost:8080/health >/dev/null && test -w /data && test -w /cache && test -w /tmp/rune
ENTRYPOINT ["dotnet", "Rune.Api.dll"]
