FROM python:3.13-slim AS base
WORKDIR /app
RUN groupadd --gid 10001 rune \
 && useradd --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin rune \
 && mkdir -p /tmp/rune \
 && chown -R 10001:10001 /tmp/rune /app \
 && chmod 0770 /tmp/rune
COPY services/rune/apps/rune-studio/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/rune/apps/rune-studio/app.py .
COPY services/rune/apps/rune-studio/src ./src
COPY services/rune/apps/rune-studio/.streamlit ./.streamlit
COPY services/rune/docs ./docs
COPY services/rune/examples ./examples
ENV PYTHONPATH=/app/src \
    RUNE_API_URL=http://rune-api:8080 \
    RUNE_DOCS_ROOT=/app/docs \
    RUNE_EXAMPLES_ROOT=/app/examples \
    TMPDIR=/tmp/rune
RUN chown -R 10001:10001 /app /tmp/rune

FROM base AS test
USER root
RUN pip install --no-cache-dir pytest==9.1.1
COPY services/rune/apps/rune-studio/tests ./tests
COPY services/rune/tools/download-web-assets.py ./tools/download-web-assets.py
COPY services/rune/tools/tests ./tool-tests
RUN chown -R 10001:10001 /app
USER 10001:10001
ENTRYPOINT ["pytest", "-q"]

FROM base AS runtime
STOPSIGNAL SIGTERM
USER 10001:10001
EXPOSE 8501
HEALTHCHECK --interval=10s --timeout=5s --retries=12 CMD python -c "import pathlib,urllib.request; p=pathlib.Path('/tmp/rune/health'); p.write_text('ok'); p.unlink(); urllib.request.urlopen('http://localhost:8501/_stcore/health', timeout=2).read()"
ENTRYPOINT ["streamlit", "run", "app.py"]
