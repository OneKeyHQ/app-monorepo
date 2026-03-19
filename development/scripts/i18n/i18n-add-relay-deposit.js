#!/usr/bin/env node
// Run via: yarn op node development/scripts/i18n/i18n-add-relay-deposit.js

const https = require('https');

function getEnvVar(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} required. Run via: yarn op`);
    process.exit(1);
  }
  return value;
}

function addKeys(keys) {
  return new Promise((resolve, reject) => {
    const token = getEnvVar('LOKALISE_TOKEN');
    const projectId = getEnvVar('LOKALISE_PROJECT_ID');
    const data = JSON.stringify({ keys });
    const options = {
      hostname: 'api.lokalise.com',
      port: 443,
      path: `/api2/projects/${projectId}/keys`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Token': token,
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201)
          resolve(JSON.parse(body));
        else reject(new Error(`Lokalise API ${res.statusCode}: ${body}`));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const KEYS = [
  {
    key_name: 'perp_relay_token__title',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'Token' },
      { language_iso: 'zh_CN', translation: '代币' },
      { language_iso: 'zh_HK', translation: '代幣' },
      { language_iso: 'zh_TW', translation: '代幣' },
      { language_iso: 'bn', translation: 'টোকেন' },
      { language_iso: 'de', translation: 'Token' },
      { language_iso: 'es', translation: 'Token' },
      { language_iso: 'fr_FR', translation: 'Jeton' },
      { language_iso: 'hi_IN', translation: 'टोकन' },
      { language_iso: 'id', translation: 'Token' },
      { language_iso: 'it_IT', translation: 'Token' },
      { language_iso: 'ja_JP', translation: 'トークン' },
      { language_iso: 'ko_KR', translation: '토큰' },
      { language_iso: 'pt_BR', translation: 'Token' },
      { language_iso: 'pt', translation: 'Token' },
      { language_iso: 'ru', translation: 'Токен' },
      { language_iso: 'th_TH', translation: 'โทเค็น' },
      { language_iso: 'uk_UA', translation: 'Токен' },
      { language_iso: 'vi', translation: 'Token' },
    ],
  },
  {
    key_name: 'perp_relay_crypto_transfer__title',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'Crypto Transfer' },
      { language_iso: 'zh_CN', translation: 'Crypto Transfer' },
      { language_iso: 'zh_HK', translation: 'Crypto Transfer' },
      { language_iso: 'zh_TW', translation: 'Crypto Transfer' },
      { language_iso: 'bn', translation: 'Crypto Transfer' },
      { language_iso: 'de', translation: 'Krypto-Überweisung' },
      { language_iso: 'es', translation: 'Transferencia Crypto' },
      { language_iso: 'fr_FR', translation: 'Transfert Crypto' },
      { language_iso: 'hi_IN', translation: 'क्रिप्टो ट्रांसफर' },
      { language_iso: 'id', translation: 'Transfer Kripto' },
      { language_iso: 'it_IT', translation: 'Trasferimento Crypto' },
      { language_iso: 'ja_JP', translation: '暗号通貨送金' },
      { language_iso: 'ko_KR', translation: '암호화폐 전송' },
      { language_iso: 'pt_BR', translation: 'Transferência Crypto' },
      { language_iso: 'pt', translation: 'Transferência Crypto' },
      { language_iso: 'ru', translation: 'Крипто-перевод' },
      { language_iso: 'th_TH', translation: 'โอนคริปโต' },
      { language_iso: 'uk_UA', translation: 'Крипто-переказ' },
      { language_iso: 'vi', translation: 'Chuyển Crypto' },
    ],
  },
  {
    key_name: 'perp_relay_crypto_transfer__desc',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'Deposit from CEX or external wallet' },
      { language_iso: 'zh_CN', translation: '从 CEX 或外部钱包充值' },
      { language_iso: 'zh_HK', translation: '從 CEX 或外部錢包充值' },
      { language_iso: 'zh_TW', translation: '從 CEX 或外部錢包充值' },
      { language_iso: 'bn', translation: 'CEX বা বাহ্যিক ওয়ালেট থেকে জমা করুন' },
      { language_iso: 'de', translation: 'Einzahlung von CEX oder externer Wallet' },
      { language_iso: 'es', translation: 'Depositar desde CEX o billetera externa' },
      { language_iso: 'fr_FR', translation: 'Déposer depuis un CEX ou un portefeuille externe' },
      { language_iso: 'hi_IN', translation: 'CEX या बाहरी वॉलेट से जमा करें' },
      { language_iso: 'id', translation: 'Deposit dari CEX atau dompet eksternal' },
      { language_iso: 'it_IT', translation: 'Deposita da CEX o portafoglio esterno' },
      { language_iso: 'ja_JP', translation: 'CEXまたは外部ウォレットから入金' },
      { language_iso: 'ko_KR', translation: 'CEX 또는 외부 지갑에서 입금' },
      { language_iso: 'pt_BR', translation: 'Depositar de CEX ou carteira externa' },
      { language_iso: 'pt', translation: 'Depositar de CEX ou carteira externa' },
      { language_iso: 'ru', translation: 'Пополнить с CEX или внешнего кошелька' },
      { language_iso: 'th_TH', translation: 'ฝากจาก CEX หรือกระเป๋าภายนอก' },
      { language_iso: 'uk_UA', translation: 'Поповнити з CEX або зовнішнього гаманця' },
      { language_iso: 'vi', translation: 'Nạp từ CEX hoặc ví bên ngoài' },
    ],
  },
  {
    key_name: 'perp_relay_wallet_deposit__desc',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'Transfer directly from your wallet' },
      { language_iso: 'zh_CN', translation: '从钱包直接转账' },
      { language_iso: 'zh_HK', translation: '從錢包直接轉賬' },
      { language_iso: 'zh_TW', translation: '從錢包直接轉帳' },
      { language_iso: 'bn', translation: 'আপনার ওয়ালেট থেকে সরাসরি ট্রান্সফার করুন' },
      { language_iso: 'de', translation: 'Direkt aus Ihrer Wallet überweisen' },
      { language_iso: 'es', translation: 'Transferir directamente desde tu billetera' },
      { language_iso: 'fr_FR', translation: 'Transférer directement depuis votre portefeuille' },
      { language_iso: 'hi_IN', translation: 'अपने वॉलेट से सीधे ट्रांसफर करें' },
      { language_iso: 'id', translation: 'Transfer langsung dari dompet Anda' },
      { language_iso: 'it_IT', translation: 'Trasferisci direttamente dal tuo portafoglio' },
      { language_iso: 'ja_JP', translation: 'ウォレットから直接送金' },
      { language_iso: 'ko_KR', translation: '지갑에서 직접 전송' },
      { language_iso: 'pt_BR', translation: 'Transferir diretamente da sua carteira' },
      { language_iso: 'pt', translation: 'Transferir diretamente da sua carteira' },
      { language_iso: 'ru', translation: 'Перевести напрямую из кошелька' },
      { language_iso: 'th_TH', translation: 'โอนโดยตรงจากกระเป๋าของคุณ' },
      { language_iso: 'uk_UA', translation: 'Переказати безпосередньо з гаманця' },
      { language_iso: 'vi', translation: 'Chuyển trực tiếp từ ví của bạn' },
    ],
  },
  {
    key_name: 'perp_relay_deposit_hint_with_max__desc',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'You can receive up to {amount} USDC. You may send any amount within the limit. Modify the amount above to estimate fees.' },
      { language_iso: 'zh_CN', translation: '您最多可接收 {amount} USDC，在限制数量内您可发送任意数量。修改上方数量以估算手续费。' },
      { language_iso: 'zh_HK', translation: '您最多可接收 {amount} USDC，在限制數量內您可發送任意數量。修改上方數量以估算手續費。' },
      { language_iso: 'zh_TW', translation: '您最多可接收 {amount} USDC，在限制數量內您可發送任意數量。修改上方數量以估算手續費。' },
      { language_iso: 'bn', translation: 'আপনি সর্বাধিক {amount} USDC পেতে পারেন। সীমার মধ্যে যেকোনো পরিমাণ পাঠাতে পারেন। ফি অনুমান করতে উপরের পরিমাণ পরিবর্তন করুন।' },
      { language_iso: 'de', translation: 'Sie können bis zu {amount} USDC empfangen. Sie können jeden Betrag innerhalb des Limits senden. Ändern Sie den Betrag oben, um Gebühren zu schätzen.' },
      { language_iso: 'es', translation: 'Puedes recibir hasta {amount} USDC. Puedes enviar cualquier cantidad dentro del límite. Modifica la cantidad arriba para estimar las tarifas.' },
      { language_iso: 'fr_FR', translation: 'Vous pouvez recevoir jusqu\'à {amount} USDC. Vous pouvez envoyer n\'importe quel montant dans la limite. Modifiez le montant ci-dessus pour estimer les frais.' },
      { language_iso: 'hi_IN', translation: 'आप अधिकतम {amount} USDC प्राप्त कर सकते हैं। आप सीमा के भीतर कोई भी राशि भेज सकते हैं। शुल्क का अनुमान लगाने के लिए ऊपर की राशि बदलें।' },
      { language_iso: 'id', translation: 'Anda dapat menerima hingga {amount} USDC. Anda dapat mengirim jumlah berapa pun dalam batas. Ubah jumlah di atas untuk memperkirakan biaya.' },
      { language_iso: 'it_IT', translation: 'Puoi ricevere fino a {amount} USDC. Puoi inviare qualsiasi importo entro il limite. Modifica l\'importo sopra per stimare le commissioni.' },
      { language_iso: 'ja_JP', translation: '最大 {amount} USDC を受け取れます。制限内であれば任意の金額を送信できます。上の金額を変更して手数料を見積もってください。' },
      { language_iso: 'ko_KR', translation: '최대 {amount} USDC를 수신할 수 있습니다. 한도 내에서 원하는 금액을 보낼 수 있습니다. 수수료를 추정하려면 위의 금액을 수정하세요.' },
      { language_iso: 'pt_BR', translation: 'Você pode receber até {amount} USDC. Você pode enviar qualquer valor dentro do limite. Modifique o valor acima para estimar as taxas.' },
      { language_iso: 'pt', translation: 'Pode receber até {amount} USDC. Pode enviar qualquer valor dentro do limite. Modifique o valor acima para estimar as taxas.' },
      { language_iso: 'ru', translation: 'Вы можете получить до {amount} USDC. Вы можете отправить любую сумму в пределах лимита. Измените сумму выше, чтобы оценить комиссии.' },
      { language_iso: 'th_TH', translation: 'คุณสามารถรับได้สูงสุด {amount} USDC คุณสามารถส่งจำนวนใดก็ได้ภายในขีดจำกัด แก้ไขจำนวนด้านบนเพื่อประมาณค่าธรรมเนียม' },
      { language_iso: 'uk_UA', translation: 'Ви можете отримати до {amount} USDC. Ви можете надіслати будь-яку суму в межах ліміту. Змініть суму вище, щоб оцінити комісії.' },
      { language_iso: 'vi', translation: 'Bạn có thể nhận tối đa {amount} USDC. Bạn có thể gửi bất kỳ số tiền nào trong giới hạn. Thay đổi số tiền ở trên để ước tính phí.' },
    ],
  },
  {
    key_name: 'perp_relay_deposit_hint__desc',
    platforms: ['web'],
    translations: [
      { language_iso: 'en_US', translation: 'You may send any amount. Modify the amount above to estimate fees.' },
      { language_iso: 'zh_CN', translation: '您可发送任意数量。修改上方数量以估算手续费。' },
      { language_iso: 'zh_HK', translation: '您可發送任意數量。修改上方數量以估算手續費。' },
      { language_iso: 'zh_TW', translation: '您可發送任意數量。修改上方數量以估算手續費。' },
      { language_iso: 'bn', translation: 'আপনি যেকোনো পরিমাণ পাঠাতে পারেন। ফি অনুমান করতে উপরের পরিমাণ পরিবর্তন করুন।' },
      { language_iso: 'de', translation: 'Sie können jeden Betrag senden. Ändern Sie den Betrag oben, um Gebühren zu schätzen.' },
      { language_iso: 'es', translation: 'Puedes enviar cualquier cantidad. Modifica la cantidad arriba para estimar las tarifas.' },
      { language_iso: 'fr_FR', translation: 'Vous pouvez envoyer n\'importe quel montant. Modifiez le montant ci-dessus pour estimer les frais.' },
      { language_iso: 'hi_IN', translation: 'आप कोई भी राशि भेज सकते हैं। शुल्क का अनुमान लगाने के लिए ऊपर की राशि बदलें।' },
      { language_iso: 'id', translation: 'Anda dapat mengirim jumlah berapa pun. Ubah jumlah di atas untuk memperkirakan biaya.' },
      { language_iso: 'it_IT', translation: 'Puoi inviare qualsiasi importo. Modifica l\'importo sopra per stimare le commissioni.' },
      { language_iso: 'ja_JP', translation: '任意の金額を送信できます。上の金額を変更して手数料を見積もってください。' },
      { language_iso: 'ko_KR', translation: '원하는 금액을 보낼 수 있습니다. 수수료를 추정하려면 위의 금액을 수정하세요.' },
      { language_iso: 'pt_BR', translation: 'Você pode enviar qualquer valor. Modifique o valor acima para estimar as taxas.' },
      { language_iso: 'pt', translation: 'Pode enviar qualquer valor. Modifique o valor acima para estimar as taxas.' },
      { language_iso: 'ru', translation: 'Вы можете отправить любую сумму. Измените сумму выше, чтобы оценить комиссии.' },
      { language_iso: 'th_TH', translation: 'คุณสามารถส่งจำนวนใดก็ได้ แก้ไขจำนวนด้านบนเพื่อประมาณค่าธรรมเนียม' },
      { language_iso: 'uk_UA', translation: 'Ви можете надіслати будь-яку суму. Змініть суму вище, щоб оцінити комісії.' },
      { language_iso: 'vi', translation: 'Bạn có thể gửi bất kỳ số tiền nào. Thay đổi số tiền ở trên để ước tính phí.' },
    ],
  },
];

async function main() {
  for (const key of KEYS) {
    process.stdout.write(`Adding ${key.key_name}... `);
    await addKeys([key]);
    console.log('✓');
  }
  console.log('\nDone! Next: yarn i18n:pull');
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
