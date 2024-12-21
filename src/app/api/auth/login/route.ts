// import { createServerClient } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// import { NextResponse } from 'next/server';

// export async function POST(request: Request) {
//   try {
//     const { email, password } = await request.json();
//     const cookieStore = cookies();
    
//     const supabase = createServerClient(
//       process.env.NEXT_PUBLIC_SUPABASE_URL!,
//       process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
//       {
//         cookies: {
//           get(name: string) {
//             return cookieStore.get(name)?.value
//           },
//           set(name: string, value: string, options) {
//             cookieStore.set({ name, value, ...options })
//           },
//           remove(name: string, options) {
//             cookieStore.set({ name, value: '', ...options })
//           },
//         },
//       }
//     );
    
//     const { data, error } = await supabase.auth.signInWithPassword({
//       email,
//       password,
//     });

//     if (error) {
//       return NextResponse.json({ error: error.message }, { status: 400 });
//     }

//     return NextResponse.json({ 
//       session: data.session,
//       user: data.user 
//     });
//   } catch (error) {
//     return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
//   }
// }