import {useState, useEffect, useRef} from 'react'

const Chat = () => {
  const [messages, setMessages] = useState([])

  const [msg, setMsg] = useState("")

  const ws = useRef(null)

  useEffect(() => {

    ws.current = new WebSocket("wss://")
    
    ws.current.onopen = (event) =>{
        console.log("connection opened!")
        //send message on open to agent for introduction
    }

    ws.current.onclose = (event)=>{

        console.log("closed!")
    }

    ws.current.onmessage = (event) =>{
        //write message to messageState. add logic for streamed responses
    }
    
    
    return () => {
        ws.current.close();
    }

  }, [])
  
  return (
    <div>
        chat
       

    </div>
  )
}

export default Chat