require("dotenv").config();
import nodeMailer, { Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";

interface IEmailOptions {
  email: string;
  subject: string;
  template: string;
  data: { [key: string]: any };
}

const sendMail = async (options: IEmailOptions) => {
  const transporter: Transporter = nodeMailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    service: process.env.SMTP_SERVICE,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const { email, subject, template, data } = options;

  // get the path to the email template file
  const emailTemplate = path.join(__dirname, `../mails/${template}.ejs`);

  // render the email template with the data
  const html: string = await ejs.renderFile(emailTemplate, data);

  const mailOptions = {
    from: process.env.SMTP_EMAIL,
    to: email,
    subject,
    html,
  };

  await transporter.sendMail(mailOptions);
};

export default sendMail;
