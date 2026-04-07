FROM node:22-alpine AS frontend-build
WORKDIR /src/Frotend/cooperate

COPY Frotend/cooperate/package.json Frotend/cooperate/package-lock.json ./
RUN npm install --no-fund --no-audit

COPY Frotend/cooperate/. ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /src/Backend

COPY Backend/Backend.csproj ./
RUN dotnet restore

COPY Backend/. ./
RUN dotnet publish Backend.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache nginx
RUN mkdir -p /app/data

ENV ASPNETCORE_URLS=http://0.0.0.0:5000
ENV DATA_FILE=/app/data/cooperate.json

COPY --from=frontend-build /src/Frotend/cooperate/dist /usr/share/nginx/html
COPY --from=backend-build /app/publish ./backend
COPY nginx.conf /etc/nginx/http.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
