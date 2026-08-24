import { networkInterfaces } from "node:os";

export default function getIPAddress() {
    const interfaces = networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
  
      if(iface){
          for (const element of iface) {
            const alias = element;
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
              return alias.address;
          }
      }
    }
    return '0.0.0.0';
  }