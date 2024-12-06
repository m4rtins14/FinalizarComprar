const express = require('express');
const cors = require('cors');
const stripe = require('stripe')('sua-chave-secreta'); // Substitua pela chave secreta do Stripe

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-payment-intent', async (req, res) => {
    const { paymentMethod, amount } = req.body;

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount, // Valor em centavos
            currency: 'brl',
            payment_method_types: paymentMethod === 'credit' ? ['card'] : ['card'], // Pode ajustar para débito/crédito
        });

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// Configurações do Pix
const pixConfig = {
    client_id: 'sua-chave-client-id',
    client_secret: 'sua-chave-client-secret',
    cert_path: './certificado-pix.pem', // Substitua pelo caminho do seu certificado Pix
    sandbox: true, // Alterar para false em produção
};

// Autenticação com a API Pix
async function authenticate() {
    const url = pixConfig.sandbox
        ? 'https://api-pix-h.gerencianet.com.br/oauth/token'
        : 'https://api-pix.gerencianet.com.br/oauth/token';

    const credentials = Buffer.from(`${pixConfig.client_id}:${pixConfig.client_secret}`).toString('base64');
    const data = 'grant_type=client_credentials';

    const response = await axios.post(url, data, {
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        httpsAgent: new (require('https').Agent)({
            cert: fs.readFileSync(pixConfig.cert_path),
            key: fs.readFileSync(pixConfig.cert_path),
        }),
    });

    return response.data.access_token;
}

// Rota para gerar o QR Code Pix
app.post('/create-pix', async (req, res) => {
    const { value } = req.body;

    try {
        const token = await authenticate();

        const url = pixConfig.sandbox
            ? 'https://api-pix-h.gerencianet.com.br/v2/cob'
            : 'https://api-pix.gerencianet.com.br/v2/cob';

        const response = await axios.post(
            url,
            {
                calendario: { expiracao: 3600 },
                valor: { original: value.toFixed(2) },
                chave: '11994895685', // Substitua pela sua chave Pix
                solicitacaoPagador: 'Pagamento do pedido',
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                httpsAgent: new (require('https').Agent)({
                    cert: fs.readFileSync(pixConfig.cert_path),
                    key: fs.readFileSync(pixConfig.cert_path),
                }),
            }
        );

        const qrCodeResponse = await axios.get(response.data.loc.qrcode, {
            responseType: 'arraybuffer',
        });

        const qrCodeBase64 = Buffer.from(qrCodeResponse.data).toString('base64');
        res.json({ qr_code: qrCodeBase64 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar QR Code Pix.' });
    }
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
