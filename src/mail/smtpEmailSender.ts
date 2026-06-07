import { once } from "node:events";
import net from "node:net";
import tls from "node:tls";
import type { VerificationEmailSender } from "../auth/emailVerification.js";

export type SmtpEmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  fromName: string;
};

type SmtpSocket = net.Socket | tls.TLSSocket;

function encodeHeader(value: string) {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function escapeData(value: string) {
  return value.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

class SmtpClient {
  private socket: SmtpSocket | null = null;
  private buffer = "";

  constructor(private readonly config: SmtpEmailConfig) {}

  async connect() {
    this.socket = this.config.secure
      ? tls.connect({ host: this.config.host, port: this.config.port, servername: this.config.host })
      : net.connect({ host: this.config.host, port: this.config.port });
    await once(this.socket, this.config.secure ? "secureConnect" : "connect");
    await this.expect([220]);
  }

  async sendMail(to: string, subject: string, text: string) {
    await this.command(`EHLO ${this.config.host}`, [250]);
    if (!this.config.secure) {
      const startTlsResponse = await this.command("STARTTLS", [220, 500, 502, 503, 504]);
      if (startTlsResponse.code === 220 && this.socket) {
        this.socket = tls.connect({ socket: this.socket, servername: this.config.host });
        this.buffer = "";
        await once(this.socket, "secureConnect");
        await this.command(`EHLO ${this.config.host}`, [250]);
      }
    }
    if (this.config.user && this.config.pass) {
      await this.command("AUTH LOGIN", [334]);
      await this.command(Buffer.from(this.config.user).toString("base64"), [334]);
      await this.command(Buffer.from(this.config.pass).toString("base64"), [235]);
    }

    await this.command(`MAIL FROM:<${this.config.from}>`, [250]);
    await this.command(`RCPT TO:<${to}>`, [250, 251]);
    await this.command("DATA", [354]);
    await this.write(`${this.message(to, subject, text)}\r\n.\r\n`);
    await this.expect([250]);
    await this.command("QUIT", [221]);
  }

  close() {
    this.socket?.end();
  }

  private message(to: string, subject: string, text: string) {
    const from = `${encodeHeader(this.config.fromName)} <${this.config.from}>`;
    return [
      `From: ${from}`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      escapeData(text)
    ].join("\r\n");
  }

  private async command(command: string, expectedCodes: number[]) {
    await this.write(`${command}\r\n`);
    return this.expect(expectedCodes);
  }

  private async write(data: string) {
    if (!this.socket) throw new Error("SMTP socket is not connected");
    this.socket.write(data);
  }

  private async expect(expectedCodes: number[]) {
    const response = await this.readResponse();
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP command failed with code ${response.code}`);
    }
    return response;
  }

  private async readResponse(): Promise<{ code: number; lines: string[] }> {
    if (!this.socket) throw new Error("SMTP socket is not connected");
    const socket = this.socket;

    return new Promise((resolve, reject) => {
      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString("utf8");
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines.at(-1);
        const match = lastLine?.match(/^(\d{3})\s/);
        if (!match) return;

        socket.off("data", onData);
        socket.off("error", onError);
        this.buffer = "";
        resolve({ code: Number(match[1]), lines });
      };
      const onError = (error: Error) => {
        socket.off("data", onData);
        reject(error);
      };
      socket.on("data", onData);
      socket.on("error", onError);
    });
  }
}

export function createSmtpEmailSender(config: SmtpEmailConfig): VerificationEmailSender {
  return {
    async sendVerificationCode(email: string, code: string) {
      const client = new SmtpClient(config);
      try {
        await client.connect();
        await client.sendMail(
          email,
          "知网文献综述助手注册验证码",
          `你的注册验证码是：${code}\n\n验证码 10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`
        );
      } finally {
        client.close();
      }
    }
  };
}
