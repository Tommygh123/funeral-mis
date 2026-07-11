function ForgotPassword(){
const [email,setEmail] = useState("");

return (
<>
<input 
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<button>
Send Reset Link
</button>

</>
)

}
You add the Supabase call to the button function.
Example:
import { supabase } from "../lib/supabase";
async function handleReset(){

const {error} =
await supabase.auth.resetPasswordForEmail(
email,
{
redirectTo:
`${import.meta.env.VITE_APP_URL}/reset-password`
}
);

if(error){

console.log(error.message);

}else{

alert("Password reset link sent");

}

}
Then:
<button onClick={handleReset}>
Send Reset Link
</button>
