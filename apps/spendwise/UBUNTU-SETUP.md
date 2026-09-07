# Ubuntu setup for finance.example.com

**VM:** YOUR_SERVER_IP
**App address after deployment:** https://finance.example.com
**App username:** syed; you choose the password during installation.


## 1. Add the DNS record

At the DNS provider for example.com, add this record if it does not already exist. Review an existing finance record before changing it.

| Type | Name / host | Value | TTL |
|---|---|---|---|
| A | finance | YOUR_SERVER_IP | Default |

Use **DNS only** initially if the provider offers a proxy/CDN toggle. Keep the existing root-domain records as they are. An AAAA record for finance must route to this same server over IPv6; otherwise remove that incorrect record for this subdomain. The installer checks the IPv4 result from the VM before making installation changes.

The VM's cloud firewall must allow TCP **80 and 443** for web access and certificate validation. Keep TCP **22** limited to your administration access. Do not open **8000** publicly.

## 2. Upload and run

Download the updated `spendwise-aws.zip`. In Windows PowerShell, from the folder containing it, replace the private-key path below with the actual local path. `ubuntu` is the assumed SSH username; replace it if your account differs.

```powershell
scp -i "C:\path\to\your-private-key.key" .\spendwise-aws.zip ubuntu@YOUR_SERVER_IP:~/
ssh -i "C:\path\to\your-private-key.key" ubuntu@YOUR_SERVER_IP
```

On the VM, extract into a new directory and run the installer:

```bash
sudo apt-get update
sudo apt-get install -y unzip
mkdir spendwise-deploy
unzip spendwise-aws.zip -d spendwise-deploy
cd spendwise-deploy/spendwise
sudo TARGET_IP=YOUR_SERVER_IP APP_DOMAIN=finance.example.com bash scripts/install-ubuntu.sh
```

For a read-only check before installation, use `sudo TARGET_IP=YOUR_SERVER_IP APP_DOMAIN=finance.example.com bash scripts/install-ubuntu.sh --check`.

The installer supports Ubuntu 22.04, 24.04 and 26.04. It installs Docker from Docker's official Ubuntu repository if needed, copies only app files into `/opt/spendwise`, creates the database and prompts for the owner password. It does not copy SSH keys or reset an existing owner password. Existing conflicting container packages cause a stop for review rather than automatic removal. [Docker's Ubuntu installation instructions](https://docs.docker.com/engine/install/ubuntu/)

## 3. Read the final installer result

**If ports 80/443 are free:** the installer starts Caddy and the app. Caddy requests the hostname's TLS certificate and redirects HTTP to HTTPS. It adds TCP 80/443 to UFW only if UFW is already active. It does not alter cloud firewall rules or enable an inactive firewall. The installer checks the public HTTPS health URL and reports failure if it cannot verify it. [Caddy HTTPS behaviour](https://caddyserver.com/docs/automatic-https)

**If a web server already owns ports 80/443:** the installer starts only the app backend on `127.0.0.1:8000`. It preserves the existing web-server configuration and prints **PUBLIC HTTPS SETUP IS STILL REQUIRED**. Add a new finance virtual host to that web server after reviewing its current configuration. Examples are included under `/opt/spendwise/proxy/`; they are not automatically enabled.

For a host-installed Caddy, merge the separate block from `proxy/Caddyfile.finance`, then validate and reload the existing Caddy configuration using its normal service commands. For host-installed Nginx, obtain the finance hostname's certificate using the server's existing certificate process, confirm its file paths, add the separate virtual host from `proxy/nginx-finance.conf`, then run `sudo nginx -t` before reload. A containerized proxy needs a shared Docker network or another deliberate route to the backend; its `localhost` does not mean the VM. Do not expose 8000 as a shortcut.

If an existing web server is detected, share the installer output and its type to get the exact integration steps. Do not replace the configuration for example.com.

## After deployment

- Open **https://finance.example.com** on your phone and laptop, then sign in as `syed` using your chosen password.
- Add a temporary entry, verify it on the second device and delete it.
- Confirm HTTPS works without certificate warnings and that entries survive an app restart.
- Create a backup and copy it to protected storage outside the VM.

The selected Compose filename is recorded in `/opt/spendwise/.deployment-mode`.

For a dedicated Caddy deployment:

```bash
cd /opt/spendwise
sudo docker compose -f compose.https.yaml ps
sudo docker compose -f compose.https.yaml logs --tail=80
sudo bash scripts/backup.sh compose.https.yaml
```

For an existing-proxy deployment, use `compose.proxy.yaml` in those commands.

## What has been verified

The app's backend checks passed previously. The new installer and configuration files have syntax/structure checks; they have not been executed on your VM. Docker build, certificate issuance, web-server integration and browser testing remain to be verified in the deployment environment. This package contains **no SSH keys**.
