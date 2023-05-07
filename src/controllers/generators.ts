import QRCode from "qrcode";
import { generatePdf } from "../helpers";
import { assetQrs } from "../templates";

export const generateQr = async (req: any, res: any) => {
  try {

    const value = await QRCode.toDataURL(req.body.text)

    const data = [
      {
        id: "123123123-1231231234-1231231234-1231231234",
        name: "Bioflu laksjd alskjdlkasjdlkas aslkdalsd",
        qr: value
      }
    ]

    const assetTemplate = assetQrs(data);

    const pdf = await generatePdf(assetTemplate);

    res.send({ message: "Done", details: pdf });

  } catch (error: any) {

    res.send({ message: "Error", details: error.message })

  }
}