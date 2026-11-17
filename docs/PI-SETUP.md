# Pornire pe Raspberry Pi 5

Aceste instructiuni sunt pentru Raspberry Pi OS Lite 64-bit, cu Pi conectat
temporar la internet prin Ethernet sau hotspot.

1. Cloneaza proiectul pe Pi:

```sh
git clone https://github.com/davidcristianpetrea/fcai.git /opt/adsense
cd /opt/adsense
```

2. Ruleaza instalarea o singura data:

```sh
sudo bash device/setup/install-pi.sh
```

Pi instaleaza Cage, Chromium, ffmpeg, v4l-utils, uv, Python 3.12, agentul,
vision, serviciile de pornire automata si reporneste. Dupa repornire, televizorul
arata codul de 6 cifre. Adauga ecranul din dashboard.

## Actualizare

```sh
cd /opt/adsense
sudo bash device/setup/update-pi.sh
```

## Hotspot de telefon

```sh
nmcli radio wifi on
nmcli device wifi list
sudo nmcli device wifi connect "NUME_HOTSPOT" password "PAROLA" ifname wlan0
nmcli connection show --active
```

Serviciile pornesc automat dupa boot. Pentru diagnostic:

```sh
sudo systemctl status adsense-agent adsense-vision adsense-kiosk
```
