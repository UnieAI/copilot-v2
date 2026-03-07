FROM alpine:3.21

RUN apk add --no-cache git ripgrep bash curl libgcc libstdc++

RUN curl -fsSL https://opencode.ai/install | bash \
    && cp /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && rm -rf /root/.opencode

RUN adduser -D -h /home/opencode opencode \
    && mkdir -p /workspace \
    && chown -R opencode:opencode /workspace /home/opencode

USER opencode
WORKDIR /workspace
ENV HOME=/home/opencode

EXPOSE 4096

ENTRYPOINT ["opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
