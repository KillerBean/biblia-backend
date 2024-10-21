export default function customHeaders(req: any, res: any, next: () => void){
    {
        res.set("X-Powered-By",false);
        next();
    }
}