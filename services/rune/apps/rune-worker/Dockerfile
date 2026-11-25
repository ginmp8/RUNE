FROM mcr.microsoft.com/dotnet/sdk:10.0.302 AS build
WORKDIR /src
COPY . .
RUN dotnet restore services/rune/apps/rune-worker/Rune.Worker.csproj \
 && dotnet publish services/rune/apps/rune-worker/Rune.Worker.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0.10 AS runtime
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    RUNE_RECOVERY_WORKER_DLL=/app/Rune.Worker.dll
COPY --from=build /app/publish .
COPY services/rune/THIRD_PARTY_NOTICES.md /app/THIRD_PARTY_NOTICES.md
COPY services/rune/licenses /app/licenses
COPY VERSION /validation/VERSION
COPY scripts/recovery_common.py scripts/verify_recovery_runtime.py scripts/verify_studio_pipeline.py /validation/scripts/
COPY services/rune/assets/reactflow /validation/services/rune/assets/reactflow
COPY services/rune/examples/reactflow /validation/services/rune/examples/reactflow
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl fontconfig fonts-dejavu-core fonts-liberation ghostscript icc-profiles-free \
      netcat-openbsd procps python3 tesseract-ocr \
 && rm -rf /var/lib/apt/lists/* \
 && dotnet Rune.Worker.dll --install-playwright \
 && python3 /validation/scripts/verify_recovery_runtime.py --output-pdf /tmp/rune-recovery-runtime.pdf \
 && groupadd --gid 10001 rune \
 && useradd --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin rune \
 && mkdir -p /data /cache /tmp/rune \
 && chown -R 10001:10001 /data /cache /tmp/rune /app /ms-playwright \
 && chmod 0770 /data /cache /tmp/rune
ENV RUNE_DATA_ROOT=/data \
    RUNE_RENDER_CACHE_ROOT=/cache \
    RUNE_BROWSER_CONCURRENCY=1 \
    TMPDIR=/tmp/rune
STOPSIGNAL SIGTERM
USER 10001:10001
HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD pgrep -f 'dotnet Rune.Worker.dll' >/dev/null && test -w /data && test -w /cache && test -w /tmp/rune && command -v gs >/dev/null && command -v tesseract >/dev/null && fc-match sans >/dev/null && test -r /usr/share/color/icc/ghostscript/srgb.icc && test -n "$(find /ms-playwright -type f -name chrome -perm -111 -print -quit)"
ENTRYPOINT ["dotnet", "Rune.Worker.dll"]

FROM build AS browser-test
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright RUNE_RUN_BROWSER_TESTS=1
RUN apt-get update \
 && apt-get install -y --no-install-recommends ghostscript icc-profiles-free tesseract-ocr \
 && rm -rf /var/lib/apt/lists/* \
 && dotnet restore services/rune/tests/Rune.Browser.Tests/Rune.Browser.Tests.csproj \
 && dotnet build services/rune/tests/Rune.Browser.Tests/Rune.Browser.Tests.csproj -c Release --no-restore \
 && dotnet /app/publish/Rune.Worker.dll --install-playwright
ENTRYPOINT ["dotnet", "test", "services/rune/tests/Rune.Browser.Tests/Rune.Browser.Tests.csproj", "-c", "Release", "--no-build", "--filter", "Category=Browser"]
