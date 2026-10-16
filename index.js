


const controller = new AbortController()

async function getData () {
  try{
    const res = await fetch('https://jsonplaceholder.typicode.com/todos/1' , {
      signal : controller.signal
    })
    const resa = await res.json()
    console.log(resa)
  }catch(err){
    console.log(err)
  }
}


getData()
