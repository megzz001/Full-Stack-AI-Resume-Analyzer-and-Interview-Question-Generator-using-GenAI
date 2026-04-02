import { RouterProvider } from 'react-router-dom'
import { router } from './app.routes.jsx'
import { AuthProvider } from './features/auth/auth.context.jsx';
import { InterviewProvider } from './features/Interview/Interview.context.jsx';

function App() {

  return (
    <div>
      <AuthProvider>
        <InterviewProvider>
          <RouterProvider router={router} />
        </InterviewProvider>
      </AuthProvider>
    </div>
  )
}

export default App
