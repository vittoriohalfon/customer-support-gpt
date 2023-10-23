import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import pg from 'pg';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const { Client } = pg;

const app = express();
app.use(express.json());
app.use(cors());

const API_KEY = process.env.API_KEY
const PORT = 8000;

const functions = [
    {
      "name": "inserimento_dc",
      "description": "Inserisce un nuovo Data Concentrator nel database.",
      "parameters": {
        "type": "object",
        "properties": {
          "Matricola_DC": {"type": "string", "description": "La matricola del DC."},
          "Concentratore": {"type": "string", "description": "Il concentratore del DC."},
          "Lat": {"type": "number", "description": "La latitudine del DC."},
          "Long": {"type": "number", "description": "La longitudine del DC."},
          "IP": {"type": "string", "description": "L'indirizzo IP del DC."},
          "Ubicazione": {"type": "string", "description": "L'ubicazione del DC."},
          "Produttore": {"type": "string", "description": "Il produttore del DC."},
          "ICCID": {"type": "string", "description": "L'ICCID del DC."},
          "Palo_GEI": {"type": "string", "description": "Il palo GEI del DC."},
          "Antenne": {"type": "number", "description": "Il numero di antenne del DC."},
          "Antenna_5dBi": {"type": "boolean", "description": "Se il DC ha un'antenna 5dBi."},
          "Data_prima_inst": {"type": "string", "description": "La data della prima installazione del DC."},
          "Classe": {"type": "string", "description": "La classe del DC."}
        },
        "required": ["Matricola_DC", "Concentratore", "Lat", "Long", "IP"]
      }
    },
    {
      "name": "sostituzione_dc",
      "description": "Sostituisce un DC esistente con nuovi dati nel database.",
      "parameters": {
        "type": "object",
        "properties": {
          "Vecchio_DC": {"type": "string", "description": "La matricola del DC da sostituire."},
          "Matricola_DC": {"type": "string", "description": "La matricola del nuovo DC."},
          "Concentratore": {"type": "string", "description": "Il concentratore del nuovo DC."},
          "Lat": {"type": "number", "description": "La latitudine del nuovo DC."},
          "Long": {"type": "number", "description": "La longitudine del nuovo DC."},
          "IP": {"type": "string", "description": "L'indirizzo IP del nuovo DC."},
          "Ubicazione": {"type": "string", "description": "L'ubicazione del nuovo DC."},
          "Produttore": {"type": "string", "description": "Il produttore del nuovo DC."},
          "ICCID": {"type": "string", "description": "L'ICCID del nuovo DC."},
          "Palo_GEI": {"type": "string", "description": "Il palo GEI del nuovo DC."},
          "Antenne": {"type": "number", "description": "Il numero di antenne del nuovo DC."},
          "Antenna_5dBi": {"type": "boolean", "description": "Se il nuovo DC ha un'antenna 5dBi."},
          "Data_prima_inst": {"type": "string", "description": "La data della prima installazione del nuovo DC."},
          "Classe": {"type": "string", "description": "La classe del nuovo DC."}
        },
        "required": ["Vecchio_DC", "Matricola_DC", "Concentratore", "Lat", "Long", "IP"]
      }
    }
  ]

app.post('/completions', async(req, res) => {
    const userMessage = {
        role: "user",
        content: req.body.message
    };

    let messages = [{"role": "user", "content":  `Sei un operatore del team di servizio clienti di Atlantica Digital spa. Per i messaggi che riceverai dai clienti di Atlantica, controlla se c'è il bisogno di chiamare una delle funzioni che ti sono state definite. Se capisci che bisogna chiamare una funzione ma mancano parametri obbligatori dall'utente, faglielo sapere.
    Ecco il messaggio che ti è stato inviato: ${userMessage.content}`}]
    console.log("Messages: ", messages);
    let functionResponseMessage = null

    try {
        // First API Call
        let response = await callOpenAI(messages);
        const functionCall = response.choices[0].message.function_call

        // Check if a function was called
        if (response.choices && response.choices[0].finish_reason === 'function_call') {
            // Perform Action (update database, etc.)
            const functionName = functionCall.name;
            const functionArgs = JSON.parse(functionCall.arguments)

            let actionResult;
            if (functionName === 'inserimento_dc') {
                actionResult = await inserimento_dc(...Object.values(functionArgs));
            } else if (functionName === 'sostituzione_dc') {
                actionResult = await sostituzione_dc(...Object.values(functionArgs));
            }

            // Create a system message to inform the model about the outcome of the function call
            functionResponseMessage = {
                role: "function",
                name: functionName,
                content: actionResult
            }
            messages.push(functionResponseMessage);

            // Second API Call
            console.log("About to make second API call with messages: ", messages);
            response = await callOpenAI(messages);
            console.log("Second API response: ", response);
        }

        res.send(response);
    } catch(error) {
        console.log(error);
        res.status(500).send({ error: 'An error occurred while processing your request.' });
    }
});

async function callOpenAI(messages) {
    const options = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        }, 
        body: JSON.stringify({
            model: "gpt-4",
            messages: messages,
            functions: functions,
            function_call: "auto",
            max_tokens: 250
        })
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", options);
    return await response.json();
}


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function insertIntoDb(client, params) {
    const query = `
        INSERT INTO Data_Concentrator (
            Matricola_DC, Concentratore, Lat, Long, IP, 
            Ubicazione, Produttore, ICCID, 
            Palo_GEI, Antenne, Antenna_5dBi, Data_prima_inst, Classe
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
    `
    return await client.query(query, params);
}

async function updateDb(client, params) {
    const query = `
        UPDATE Data_Concentrator SET 
            Matricola_DC = $1, 
            Concentratore = $2, 
            Lat = $3, 
            Long = $4, 
            IP = $5, 
            Ubicazione = $6, 
            Produttore = $7, 
            ICCID = $8, 
            Palo_GEI = $9, 
            Antenne = $10, 
            Antenna_5dBi = $11, 
            Data_prima_inst = $12, 
            Classe = $13
        WHERE Matricola_DC = $14
        RETURNING *;
    `
    return await client.query(query, params)
}

async function sendEmailNotification(mailOptions) {
    return await transporter.sendMail(mailOptions)
}

async function inserimento_dc(
    Matricola_DC, Concentratore, Lat, Long, IP, 
    Ubicazione = null, Produttore = null, ICCID = null, 
    Palo_GEI = null, Antenne = null, Antenna_5dBi = null, 
    Data_prima_inst = null, Classe = null) 
{
    if (!Matricola_DC || !Concentratore || !Lat || !Long || !IP) {
        throw new Error('Parametri obbligatori mancanti.');
    }

    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'mockdb2'
    });

    let dbError = null;
    let emailError = null;

    try {
        await client.connect();
        await insertIntoDb(client, [
            Matricola_DC, Concentratore, Lat, Long, IP, 
            Ubicazione, Produttore, ICCID,
            Palo_GEI, Antenne, Antenna_5dBi, Data_prima_inst, Classe
        ]);
    } catch (err) {
        console.error('Errore durante l\'inserimento del DC:', err);
        dbError = err;
    } finally {
        await client.end();
    }

    const mailOptions = {
        from: 'vittoriohalfon01@gmail.com',
        to: 'vittoriomining@gmail.com',
        subject: 'Insierimento DC - Atlantica Digital',
        text: `Il DC con matricola ${Matricola_DC} è stato inserito e configurato con successo.`
    }
    
    try {
        await sendEmailNotification(mailOptions);
    } catch (error) {
        console.error('Errore durante l\'invio dell\'email:', error);
        emailError = error;
    }

    // Handle the four scenarios
    if (!dbError && !emailError) {
        return 'DB updated successfully and email sent';
    } else if (!dbError && emailError) {
        throw new Error(`DB updated successfully. Email not sent: ${emailError.message}`);
    } else if (dbError && !emailError) {
        throw new Error(`DB not updated: ${dbError.message}. Email sent`);
    } else {
        throw new Error(`DB not updated: ${dbError.message}. Email not sent: ${emailError.message}`);
    }
}

async function sostituzione_dc(
    Vecchio_DC, Matricola_DC, Concentratore, Lat, Long, IP, 
    Ubicazione = null, Produttore = null, ICCID = null, 
    Palo_GEI = null, Antenne = null, Antenna_5dBi = null, 
    Data_prima_inst = null, Classe = null) 
{
    if (!Vecchio_DC || !Matricola_DC || !Concentratore || !Lat || !Long || !IP) {
        throw new Error('Parametri obbligatori mancanti.');
    }

    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    let dbError = null;
    let emailError = null;

    try {
        await client.connect();
        await updateDb(client, [
            Matricola_DC, Concentratore, Lat, Long, IP, 
            Ubicazione, Produttore, ICCID,
            Palo_GEI, Antenne, Antenna_5dBi, Data_prima_inst, Classe,
            Vecchio_DC
        ])
    } catch (err) {
        console.error('Errore durante l\'aggiornamento del DC:', err);
        dbError = err;
    } finally {
        await client.end();
    }

    const mailOptions = {
        from: 'vittoriohalfon01@gmail.com',
        to: 'vittoriomining@gmail.com',
        subject: 'Sostituzione DC - Atlantica Digital',
        text: `Il DC con matricola ${Vecchio_DC} è stato sostituito con il DC con matricola ${Matricola_DC} con successo.`
    };

    try {
        await sendEmailNotification(mailOptions);
    } catch (error) {
        console.error('Errore durante l\'invio dell\'email:', error);
        emailError = error;
    }

    // Handle the four scenarios
    if (!dbError && !emailError) {
        return 'DB updated successfully and email sent';
    } else if (!dbError && emailError) {
        throw new Error(`DB updated successfully. Email not sent: ${emailError.message}`);
    } else if (dbError && !emailError) {
        throw new Error(`DB not updated: ${dbError.message}. Email sent`);
    } else {
        throw new Error(`DB not updated: ${dbError.message}. Email not sent: ${emailError.message}`);
    }
}


app.listen(PORT, () => console.log(`Server running on port ${PORT}. `));
console.log(`API Key is: ${API_KEY}`);