FROM node:22-alpine AS ui_development
WORKDIR /usr/src/app
COPY gui_aspire ./
RUN npm install
RUN npm run build

FROM mambaorg/micromamba:bookworm-slim

USER root

ARG aspire_version="Non-versioned"
ENV ASPIRE_VERSION=$aspire_version

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gdebi-core \
    nginx \
    && rm -rf /var/lib/apt/lists/*

ARG QUARTO_VERSION="1.5.57"
RUN curl -o quarto-linux-amd64.deb -L https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.deb \
    && gdebi --non-interactive quarto-linux-amd64.deb \
    && rm quarto-linux-amd64.deb \
    && apt remove -y curl gdebi-core

# 2. Copiamos tu archivo de configuración de Nginx personalizado
# Primero eliminamos las configuraciones por defecto
RUN rm /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default
COPY nginx.conf /etc/nginx/sites-available/default
RUN ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# 3. Ajustamos permisos globales de Nginx para que $MAMBA_USER pueda ejecutarlo sin root
RUN sed -i 's/user www-data;//g' /etc/nginx/nginx.conf \
    && sed -i 's|pid /run/nginx.pid;|pid /var/lib/nginx/nginx.pid;|g' /etc/nginx/nginx.conf \
    && mkdir -p /var/log/nginx /var/lib/nginx \
    && chown -R $MAMBA_USER:$MAMBA_USER /var/log/nginx /var/lib/nginx /var/www/html /etc/nginx

USER $MAMBA_USER

COPY --chown=$MAMBA_USER:$MAMBA_USER env.yaml /tmp/env.yaml
RUN micromamba create -y -f /tmp/env.yaml \
    && micromamba run -n aspire pip uninstall -y tangled_up_in_unicode \
    && micromamba clean --all --yes \
    && rm -rf /opt/conda/conda-meta /tmp/env.yaml

RUN echo "micromamba activate aspire" >> ~/.bashrc
RUN echo "export PATH=/opt/conda/envs/aspire/bin:${PATH}"  >> ~/.bashrc

COPY --from=ui_development --chown=$MAMBA_USER:$MAMBA_USER /usr/src/app/dist /var/www/html/
# COPY --chown=$MAMBA_USER:$MAMBA_USER gui_aspire /home/$MAMBA_USER
COPY --chown=$MAMBA_USER:$MAMBA_USER api_aspire /home/$MAMBA_USER
COPY --chown=$MAMBA_USER:$MAMBA_USER projects /home/$MAMBA_USER/projects

COPY --chown=$MAMBA_USER:$MAMBA_USER entrypoint.sh /opt/entrypoint.sh
RUN chmod +x /opt/entrypoint.sh

EXPOSE 3000

WORKDIR /home/$MAMBA_USER
ENTRYPOINT ["micromamba","run","-n","aspire","/opt/entrypoint.sh"]
