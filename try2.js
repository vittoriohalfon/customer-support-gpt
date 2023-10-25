import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import pg from 'pg'
import dotenv from 'dotenv'
import nodemailer from 'nodemailer'

dotenv.config()

const { Client } = pg

const app = express()
app.use(express.json())
app.use(cors())

const API_KEY = process.env.API_KEY
const PORT = process.env.PORT || 8000

const functions = [
    {
      "name": "inserimento_dc",
      "description": "Quando un cliente attiva un DC, bisogna inserire i dati del DC nel database. Questa funzione inserisce il DC nel database e manda una mail di conferma al cliente. Inserisci solamente parametri che ti sono stati dati dal cliente, non inventarli.",
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
          "Classe": {"type": "string", "description": "La classe del DC."},
          "isRf": {"type": "boolean", "description": "Un flag che indica se l'utente ha menzionato che tutte e due le rf sono su xxxxx (dove xxxxx sono numeri). Se non lo menziona, segnalo come False."}
        },
        "required": ["Matricola_DC", "Concentratore", "Lat", "Long", "IP"]
      }
    },
    {
      "name": "sostituzione_dc",
      "description": "Quando un cliente sostituisce un DC, bisogna aggiornare i dati del DC nel database. Questa funzione aggiorna il DC nel database e manda una mail di conferma al cliente. Inserisci solamente parametri che ti sono stati dati dal cliente, non inventarli.",
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
          "Antenna_5dBi": {"type": "boolean", "description": "Un flag che indica se il nuovo DC ha un'antenna 5dBi."},
          "Data_prima_inst": {"type": "string", "description": "La data della prima installazione del nuovo DC."},
          "Classe": {"type": "string", "description": "La classe del nuovo DC."},
          "isRf": {"type": "boolean", "description": "Un flag che indica se l'utente ha menzionato che tutte e due le rf sono su xxxxx (dove xxxxx sono numeri). Se non lo menziona, segnalo come false."}
        },
        "required": ["Vecchio_DC", "Matricola_DC", "Concentratore", "Lat", "Long", "IP"]
      }
    },
    {
        "name": "annullaAvviso",
        "description": "Quando un cliente deve annullare avviso, bisogna chiamare questa funzione per aggiornare il sistema. Inserisci solamente parametri che ti sono stati dati dal cliente, non inventarli.",
        "parameters": {
            "type": "object",
            "properties": {
                "idAvviso": {"type": "string", "description": "L'ID dell'avviso da annullare. (esempio: MIM3349807)"},
                "idPdr": {"type": "string", "description": "L'ID del PDR che ha generato l'avviso. (esempio: 10400000635476"},
            },
            "required": ["idAvviso"]
        }
    },
    {
        "name": "gestisciAvvisoZK",
        "description": "Gestisce la casistica AVVISO ZK, dove un avviso è stato consuntivato ma il correttore è sospeso in SGM - MIM, girando l'incident a SGMG con motivazione e nota specifica. Inserisci solamente parametri che ti sono stati dati dal cliente, non inventarli.",
        "parameters": {
            "type": "object",
            "properties": {
                "idAvviso": {
                    "type": "string",
                    "description": "L'ID dell'avviso in oggetto."
                }
            },
            "required": ["idAvviso"]
        }
    }, 
    {
        "name": "gestisciAvvisoSostituzioneBatteria",
        "description": "Questa funzione gestisce i casi di avvisi di sostituzione batteria che non passano in WFM, verificando lo stato dell'ordine nel sistema e girando l'incidente a differenti livelli di assistenza se necessario. Inserisci solamente parametri che ti sono stati dati dal cliente, non inventarli.",
        "parameters": {
            "type": "object",
            "properties": {
                "podId": {
                    "type": "string",
                    "description": "L'ID del Pod per il quale l'avviso di sostituzione batteria è stato creato e deve essere verificato.",
                },
            },
            "required": ["podId"],
        },
    },
    {
        "name": "gestisciMatricolaNonAllineata",
        "description": "Questa funzione gestisce gli errori relativi alle matricole non allineate a causa di uno scarto anagrafico. In base a una descrizione di errore selezionata casualmente da un insieme predefinito, la funzione genera un messaggio che indica l'errore e il team a cui l'incidente è stato girato.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }    
  ]

  // Memorizzazione dello stato della conversazione
  let conversationHistory = [
    {
        role: "system",
        content: "Sei un operatore del customer service di Atlantica Digital spa, ti sono state definite varie funzioni, chiamale se necessario. Se non sai la risposta a qualcosa, riferisci all'utente che lo metterai a contatto con un operatore umano."
    }
]


app.post('/completions', async (req, res) => {
    const userMessage = {
        role: "user",
        content: req.body.message
    }

    conversationHistory.push(userMessage)

    let messages = [...conversationHistory]

    let functionResponseMessage = null

    try {
        // First API Call
        let response = await callOpenAI(messages)
        const functionCall = response.choices[0].message.function_call

        // Check if a function was called
        if (response.choices && response.choices[0].finish_reason === 'function_call') {
            console.log(functionCall.arguments)
            // Perform Action (update database, etc.)
            const functionName = functionCall.name
            const functionArgs = JSON.parse(functionCall.arguments)

            let actionResult
            if (functionName === 'inserimento_dc') {
                actionResult = await inserimento_dc(functionArgs)
            } else if (functionName === 'sostituzione_dc') {
                actionResult = await sostituzione_dc(functionArgs)
            } else if (functionName === 'annullaAvviso') {
                actionResult = await annullaAvviso(functionArgs)
            } else if (functionName === 'gestisciAvvisoZK') {
                actionResult = await gestisciAvvisoZK(functionArgs)
            } else if (functionName === 'gestisciAvvisoSostituzioneBatteria') {
                actionResult = await gestisciAvvisoSostituzioneBatteria(functionArgs)
            } else if (functionName === 'gestisciMatricolaNonAllineata') {
                actionResult = gestisciMatricolaNonAllineata()
            }

            // Create a system message to inform the model about the outcome of the function call
            functionResponseMessage = {
                role: "function",
                name: functionName,
                content: `Risultato funzione: ${actionResult}. Informa l'utente di quanto accaduto SENZA chiamare un'altra funzione.`
            }
            messages.push(functionResponseMessage)

            // Second API Call
            response = await callOpenAI(messages)

            const aiResponse = {
                role: "assistant",
                content: response.choices[0].message.content
            }
            messages.push(aiResponse)
            conversationHistory.push(aiResponse)
        }

        res.send(response)
    } catch (error) {
        console.log(error)
        res.status(500).send({ error: 'An error occurred while processing your request.' })
    }
})

async function callOpenAI(messages) {
    console.log("Sending messages:", messages)
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
            temperature: 0.1,
            max_tokens: 200
        })
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", options)
    return await response.json()
}


// Defined functions
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
    return await client.query(query, params)
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

async function inserimento_dc({
    Matricola_DC, Concentratore, Lat, Long, IP, 
    Ubicazione = null, Produttore = null, ICCID = null, 
    Palo_GEI = null, Antenne = null, Antenna_5dBi = null, 
    Data_prima_inst = null, Classe = null, isRf = null
}) {
    let missingParams = []

    if (!Matricola_DC) missingParams.push("Matricola DC")
    if (!Concentratore) missingParams.push("Concentratore")
    if (!Lat) missingParams.push("Latitudine")
    if (!Long) missingParams.push("Longitudine")
    if (!IP) missingParams.push("Indirizzo IP")

    if (missingParams.length > 0) {
        return `Parametri obbligatori mancanti: ${missingParams.join(", ")}. Assicurarsi di averli inseriti.`
    }


    let mess1 = ""

    if (isRf == true) {
        mess1 = 'rf.properties è stato aggiornato con successo: CHANNEL_RF2=1'
    }

    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'mockdb2'
    })

    let dbError = null
    let emailError = null

    try {
        await client.connect()
        await insertIntoDb(client, [
            Matricola_DC, Concentratore, Lat, Long, IP, 
            Ubicazione, Produttore, ICCID,
            Palo_GEI, Antenne, Antenna_5dBi, Data_prima_inst, Classe
        ])
    } catch (err) {
        console.error('Errore durante l\'inserimento del DC:', err)
        dbError = err
    } finally {
        await client.end()
    }

    const mailOptions = {
        from: 'vittoriohalfon01@gmail.com',
        to: 'vittoriomining@gmail.com',
        subject: 'Conferma Configurazione DC - Atlantica Digital',
        text: `Il DC con matricola ${Matricola_DC} è stato inserito e configurato con successo.`,
        attachments: [
            {
                filename: 'atlantica.png',
                path: './atlantica.png',
            }
        ]
    }

    try {
        await sendEmailNotification(mailOptions)
    } catch (error) {
        console.error('Errore durante l\'invio dell\'email:', error)
        emailError = error
    }

    // Handle the four scenarios
    if (!dbError && !emailError) {
        return `Database aggiornato con successo e email inviata. ${mess1}`
    } else if (!dbError && emailError) {
        return(`Database aggiornato con successo ma la mail non è stata inviata: ${emailError.message}. ${mess1}`)
    } else if (dbError && !emailError) {
        return(`Database non aggiornato: ${dbError.message}. Email inviata. ${mess1}`)
    } else {
        return(`DB non aggiornato: ${dbError.message}. Mail non aggiornata: ${emailError.message}. ${mess1}`)
    }
}

async function sostituzione_dc({
    Vecchio_DC, Matricola_DC, Concentratore, Lat, Long, IP, 
    Ubicazione = null, Produttore = null, ICCID = null, 
    Palo_GEI = null, Antenne = null, Antenna_5dBi = null, 
    Data_prima_inst = null, Classe = null, isRf = null
}) {
    let missingParams = []

    if (!Vecchio_DC) missingParams.push("Vecchio DC")
    if (!Matricola_DC) missingParams.push("Matricola DC")
    if (!Concentratore) missingParams.push("Concentratore")
    if (!Lat) missingParams.push("Latitudine")
    if (!Long) missingParams.push("Longitudine")
    if (!IP) missingParams.push("Indirizzo IP")

    if (missingParams.length > 0) {
        return `Parametri obbligatori mancanti: ${missingParams.join(", ")}. Assicurarsi di averli inseriti.`
    }

    let mess1 = ""

    if (isRf === true) {
        mess1 = 'rf.properties è stato aggiornato con successo: CHANNEL_RF1, CHANNEL_RF2 =1'
    }

    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password',
        database: 'mockdb2'
    })

    let dbError = null
    let emailError = null

    try {
        await client.connect()
        await updateDb(client, [
            Matricola_DC, Concentratore, Lat, Long, IP, 
            Ubicazione, Produttore, ICCID,
            Palo_GEI, Antenne, Antenna_5dBi, Data_prima_inst, Classe,
            Vecchio_DC
        ])
    } catch (err) {
        console.error('Errore durante l\'aggiornamento del DC:', err)
        dbError = err
    } finally {
        await client.end()
    }

    const mailOptions = {
        from: 'vittoriohalfon01@gmail.com',
        to: 'vittoriomining@gmail.com',
        subject: 'Sostituzione DC - Atlantica Digital',
        text: `Il DC con matricola ${Vecchio_DC} è stato sostituito con il DC con matricola ${Matricola_DC} con successo.`,
        attachments: [
            {
                filename: 'atlantica.png',
                path: './atlantica.png',
            }
        ]
    }

    try {
        await sendEmailNotification(mailOptions)
    } catch (error) {
        console.error('Errore durante l\'invio dell\'email:', error)
        emailError = error
    }

    // Handle the four scenarios
    if (!dbError && !emailError) {
        return `Database aggiornato con successo (conferma sostituzione DC) e email inviata. ${mess1}`
    } else if (!dbError && emailError) {
        return(`Database aggiornato con successo. Email non inviata: ${emailError.message}. ${mess1}`)
    } else if (dbError && !emailError) {
        return(`Database non aggiornato ${dbError.message}. Email inviata. ${mess1}`)
    } else {
        return(`DB non aggiornato: ${dbError.message}. Email non inviata: ${emailError.message}. ${mess1}`)
    }
}

async function annullaAvviso({idAvviso, idPdr = null}) {
    if (idPdr) {
        return `Avviso ${idAvviso}, ${idPdr} annullato con successo.`
    } else {
        return `Avviso ${idAvviso} annullato con successo.`
    }
}

async function gestisciAvvisoZK({idAvviso}) {

    // Verifica se l'ID dell'avviso è fornito
    if (!idAvviso) {
        return('ID dell\'avviso non fornito.')
    }

    // Qui potrebbe esserci una logica che verifica il correttore in SGM - MIM
    // Per esempio, una chiamata API o un controllo su database. 
    // Per questo esempio, simulerò una verifica con un valore fittizio.
    const correttoreSospeso = true

    // In caso il correttore sia sospeso, girare l'incidente a SGMG
    if (correttoreSospeso) {
        try {
            // Qui potrebbe esserci una logica per girare l'incidente a SGMG.
            // Potrebbe trattarsi di una chiamata API o di un aggiornamento su database.
            // Per questo esempio, farò un log e supporrò che l'operazione sia riuscita.
            console.log(`Incidente con ID ${idAvviso} girato a SGMG con motivo: Caso integrazione. Nota: Si prega di aggiornare il PDR come richiesto.`)

            // Restituisci una conferma in caso di successo
            return 'PDR Aggiornato e incident girato a SGMG'
        } catch (error) {
            // Gestisci qualsiasi errore possa verificarsi mentre si gira l'incidente a SGMG
            return(`Errore nel girare l'incidente a SGMG: ${error.message}`)
        }
    } else {
        // Gestisci il caso in cui il correttore non sia sospeso
        return 'Il correttore non risulta sospeso in SGM - MIM e pertanto l\'incidente non sarà girato a SGMG.'
    }
}

async function gestisciAvvisoSostituzioneBatteria({podId}) {
    const client = new Client({
        host: 'localhost',
        port: 5432,
        user: 'postgres',
        password: 'password', // Considera di utilizzare variabili d'ambiente o altri metodi sicuri per immagazzinare le credenziali
        database: 'mockdb2'
    })

    try {
        await client.connect()

        // Esegui la query SQL per ottenere i dati
        const res = await client.query("SELECT * FROM SURVEY_BATTERY_REQ sbr WHERE POD_ID = $1", [podId])

        // Controlla i risultati e gestisci di conseguenza
        if (res.rows.length > 0) {
            const wfmState = res.rows[0].wfm_state
            if (wfmState === 'SEND_ERROR') {
                // La tua logica qui, ad es. inviare all'assistenza di secondo livello
                const risposta = "WFM_STATE = Send_Error, dunque l'incident è stato girato ad assistenti di secondo livello"
                return risposta
            } else {
                // Altra logica qui, ad es. gestire stati diversi
                return "Nessun Errore Rilevato"
            }
        } else {
            // Gestione di quando non ci sono risultati
            const risposta = "Nessun record trovato per il Pod ID fornito nel Database Atlantica"
            return risposta
        }
    } catch (err) {
        console.error(err)
        throw new Error('Errore durante la gestione dell\'avviso di sostituzione batteria')
    } finally {
        await client.end()
    }
}

function gestisciMatricolaNonAllineata() {
    // Array delle possibili descrizioni dell'errore
    const descrizioniErrore = [
        "Costruttore correttore non conforme",
        "Costruttore misuratore non conforme",
        "Costruttore modem non conforme",
        "Numero di telefono SIM non conforme"
    ]

    // Scegliere una descrizione dell'errore a caso
    const descrizioneErrore = descrizioniErrore[Math.floor(Math.random() * descrizioniErrore.length)]

    // Costruire la stringa di risposta
    const risposta = `Errore: ${descrizioneErrore}. Incident girato a AMS_Open_Principali_Misura_Engineering. Servizio cambiato a SGMG`

    // Restituire la stringa di risposta
    return risposta
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}. `))