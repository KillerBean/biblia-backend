import { fileURLToPath } from 'node:url';
import path from 'node:path';


class PathUtils {
    static get __filename() {
        return fileURLToPath(import.meta.url);
    }

    static get __dirname() {
        return path.dirname(PathUtils.__filename);
    }
}

export default PathUtils;
