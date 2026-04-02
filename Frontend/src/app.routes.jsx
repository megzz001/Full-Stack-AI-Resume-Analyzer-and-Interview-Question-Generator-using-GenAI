import Home from "./features/Interview/pages/Home";
import Login from "./features/auth/pages/Login";
import Register from "./features/auth/pages/Register";
import Protected from "./features/auth/components/Protected";
import  Interview  from "./features/Interview/pages/Interview";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
    {
        path:"/",
        element: <Protected><Home /></Protected>  // or create a Home component
    },
    {
        path:"/login",
        element:<Login/>
    },
    {
        path:"/register",   
        element:<Register/>
    },
    {
        path:"/interview/:interviewId",
        element:<Protected><Interview/></Protected>

    },
    {
        path:"*",  // catch-all for undefined routes
        element:<div>404 - Page Not Found</div>
    }
])