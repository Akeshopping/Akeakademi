// /mobile ve altındaki her adres: mobil uygulama kaynakları web'den sunulmaz (bkz. lib/yol-koruma.js). Her yöntem için 404 + no-store.
import { korumaYaniti } from "../../lib/yol-koruma.js";
export const onRequest = () => korumaYaniti();
