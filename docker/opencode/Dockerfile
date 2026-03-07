FROM alpine:3.21

RUN apk add --no-cache git ripgrep bash curl ca-certificates libgcc libstdc++ su-exec

RUN curl -fsSL https://opencode.ai/install | bash \
    && cp /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && rm -rf /root/.opencode

RUN adduser -D -h /home/opencode opencode \
    && mkdir -p /workspace /home/opencode/.config /home/opencode/.cache /home/opencode/.local/share \
    && chown -R opencode:opencode /workspace /home/opencode

COPY entrypoint.sh /usr/local/bin/agent-entrypoint
RUN chmod 755 /usr/local/bin/agent-entrypoint

WORKDIR /workspace
ENV HOME=/home/opencode
ENV XDG_CONFIG_HOME=/home/opencode/.config
ENV XDG_CACHE_HOME=/home/opencode/.cache
ENV XDG_DATA_HOME=/home/opencode/.local/share

EXPOSE 4096

ENTRYPOINT ["/usr/local/bin/agent-entrypoint"]
