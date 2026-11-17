# Pornire pe Windows

1. Instaleaza Git, Python 3.12 si `uv`.
2. Deschide PowerShell in folderul proiectului.
3. Ruleaza:

```powershell
.\start.ps1
```

Se deschid automat agentul, camera si Chrome in modul ecran complet. La primul
start, televizorul arata un cod. Intra pe `https://adsense.davidpetrea.ro`,
autentifica-te, deschide **Display-uri → Adauga ecran**, introdu codul si un
nume, apoi ecranul porneste singur.

Pentru o oprire curata inchide Chrome sau apasa `Ctrl+C` in PowerShell.

## Telefon ca hotspot

Pe Pi, conecteaza telefonul la hotspot cu NetworkManager:

```sh
nmcli radio wifi on
nmcli device wifi list
sudo nmcli device wifi connect "NUME_HOTSPOT" password "PAROLA" ifname wlan0
```

Verifica legatura:

```sh
nmcli connection show --active
```
