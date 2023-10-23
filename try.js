import nodemailer from 'nodemailer'
import pkg from 'pg';
const { Client } = pkg;


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'vittoriohalfon01@gmail.com',
        pass: 'eean xxjv kwhg lmiw'
    }
})

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

inserimento_dc(666, 'Concentratore', 45.123, 9.456, 'indirizzo IP fittizio', 'Milano')

