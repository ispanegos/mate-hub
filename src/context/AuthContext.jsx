import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

async function ensureProfile(user) {
  if (!user) return null

  const { data: existing, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (existing) return existing

  const fallbackUsername =
    user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`

  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: user.id, username: fallbackUsername, avatar_url: null })
    .select('*')
    .single()

  if (insertError) throw insertError
  return created
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    async function bootstrap(nextSession) {
      setSession(nextSession)
      if (nextSession?.user) {
        try {
          const p = await ensureProfile(nextSession.user)
          if (mounted.current) {
            setProfile(p)
            setProfileError(null)
          }
        } catch (err) {
          if (mounted.current) setProfileError(err)
        }
      } else if (mounted.current) {
        setProfile(null)
      }
      if (mounted.current) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => bootstrap(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      bootstrap(nextSession)
    })

    return () => {
      mounted.current = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signUp = async ({ email, password, username }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })
    if (error) throw error
    return data
  }

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  const updatePassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  const updateProfile = async (patch) => {
    if (!session?.user) throw new Error('Nessuna sessione attiva')
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select('*')
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    profileError,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    updatePassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
