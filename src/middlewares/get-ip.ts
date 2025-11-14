import { networkInterfaces } from "node:os";

export default function getIPAddress() {
    let interfaces = networkInterfaces();
    for (let devName in interfaces) {
      let iface = interfaces[devName];
  
      if(iface){
          for (const element of iface) {
            let alias = element;
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
              return alias.address;
          }
      }
    }
    return '0.0.0.0';
  }