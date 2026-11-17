import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.0.100', username='davidpetrea-adsense', password='rootserver19527', timeout=10)
stdin, stdout, stderr = ssh.exec_command('source ~/.bashrc 2>/dev/null; source ~/.nvm/nvm.sh 2>/dev/null; pm2 logs adsense-web --lines 20 --nostream')
print("PM2 LOGS:\n", stdout.read().decode())
print("STDERR:\n", stderr.read().decode())
ssh.close()
