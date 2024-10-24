import { networkInterfaces } from "node:os";

export default function getIPAddress() {
    var interfaces = networkInterfaces();
    for (var devName in interfaces) {
      var iface = interfaces[devName];
  
      if(iface){
          for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
              return alias.address;
          }
      }
    }
    return '0.0.0.0';
  }