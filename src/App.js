import { useEffect, useState } from "react"

function App() {

  const [value, setValue] = useState(null)
  const [message, setMessage] = useState(null)
  const [previousChats, setPreviousChats] = useState([])
  const [currentTitle, setCurrentTitle] = useState(null)
  const [loading, setLoading] = useState(false)

  function createNewChat() {
    setMessage(null)
    setValue("")
    setCurrentTitle(null)
  }

  function handleClick(uniqueTitle) {
    setCurrentTitle(uniqueTitle)
    setMessage(null)
    setValue("") 
  }

  const getMessages = async () => {
    setLoading(true)
    const options = {
      method: "POST",
      body: JSON.stringify({
        message: value
      }),
      headers: {
        "Content-Type": "application/json"
      }
    }
    try{
      const response = await fetch("http://localhost:8000/completions", options)
      const data = await response.json()
      setMessage(data.choices[0].message)
    } catch(error){
      console.log(error)
    } finally {
      setLoading(false)
    }
  }  

  useEffect(() => {
    console.log(currentTitle, value, message)
    if (!currentTitle && value && message) {
      setCurrentTitle(value)
    } 
    if (currentTitle && value && message) {
      setPreviousChats(previousChats => (
        [...previousChats, 
          {
            title: currentTitle, 
            role: "user",
            content: value
          },
          {
            title: currentTitle,
            role: message.role,
            content: message.content
          }
        ]
      ))
    }
  }, [message, currentTitle])

  console.log(previousChats)

  const currentChat = previousChats.filter(previousChat => previousChat.title === currentTitle)
  const uniqueTitles = Array.from(new Set (previousChats.map(previousChat => previousChat.title)))
  console.log(uniqueTitles)

  function calculateRows(value) {
    const charLimit = 56 
    // Check if value is not null or undefined before trying to access its length
    const numOfLines = value ? Math.ceil(value.length / charLimit) : 1
    return numOfLines
}

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault() // Prevents new line on Enter
      if (e.shiftKey) {
        // If Shift + Enter, add a new line
        setValue(prev => prev + "\n")
      } else {
        // If Enter only, send message
        getMessages()
      }
    }
  }

  function LoadingIcon() {
    return (
        <div className="loading-icon">
            QueriesGPT is analyzing the request...
        </div>
    )
}

  return (
    <div className="app">
      <section className = "side-bar">
        <button onClick={createNewChat}>+ New Chat</button>
        <ul className = "history">
          {uniqueTitles?.map((uniqueTitle, index) => <li key = {index} onClick={() => handleClick(uniqueTitle)}>{uniqueTitle}</li>)}
        </ul>
        <nav>
          <p>Made by Vittorio</p>
        </nav>
      </section>
      <section className = "main">
        {!currentTitle && <h1>SupportAI - Customer Support</h1>}
        <ul className = "feed">
          {currentChat?.map((chatMessage, index) => <li key={index}> 
          <p className = "role">{chatMessage.role}</p>
          <p>{chatMessage.content}</p>
          </li>)}
        </ul>
        <div className = "bottom-section">
          {loading && <LoadingIcon />}
          <div className = "input-container">
            <textarea value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={handleKeyDown} rows={calculateRows(value)}/>
            <div id = "submit" onClick={getMessages}>➢</div>
          </div>
          <p className = "info">This chatbot was designed to solve specific customer queries, including updating relevant DB tables, refer to README.md.
          </p>
        </div>
      </section>
    </div>
  )
}

export default App