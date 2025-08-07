// Estas son tus claves de proyecto de Supabase
const supabaseUrl = 'https://nihwpbxkwrndxubpqkes.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5paHdwYnhrd3JuZHh1YnBxa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1Njc3MDgsImV4cCI6MjA3MDE0MzcwOH0.MTl0cNJFxkevLJWOUCsSgNyFHSTf9rZ7yop-OQlSNpg';
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {

    const gruposTableBody = document.getElementById('grupos-table-body');
    const miembrosTableBody = document.getElementById('miembros-table-body');
    const manageGroupSection = document.getElementById('manage-group-section');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const updateMemberForm = document.getElementById('update-member-form');
    
    // --- Funciones de renderizado ---

    async function renderGrupos() {
        const { data: grupos, error } = await supabase
            .from('grupos')
            .select('*')
            .order('puntos_totales', { ascending: false });

        if (error) {
            console.error('Error al obtener los grupos:', error);
            return;
        }

        gruposTableBody.innerHTML = '';
        grupos.forEach(grupo => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${grupo.nombre}</td>
                <td>${grupo.puntos_totales || 0}</td>
                <td class="actions-cell" style="display: none;"></td>
            `;
            gruposTableBody.appendChild(row);
        });
    }

    async function renderMiembrosDelGrupo(idGrupo, puedeEditar) {
        const { data: miembros, error } = await supabase
            .from('miembros_del_clan')
            .select('*')
            .eq('id_grupo', idGrupo)
            .order('puntos', { ascending: false });

        if (error) {
            console.error('Error al obtener los miembros:', error);
            return;
        }

        miembrosTableBody.innerHTML = '';
        miembros.forEach(miembro => {
            const row = document.createElement('tr');
            let actionsCell = '';
            if (puedeEditar) {
                actionsCell = `
                    <td>
                        <button class="edit-btn" data-id="${miembro.id}">Editar</button>
                        <button class="delete-btn" data-id="${miembro.id}">Expulsar</button>
                    </td>
                `;
            }
            row.innerHTML = `
                <td>${miembro.nombre}</td>
                <td>${miembro.puntos}</td>
                ${actionsCell}
            `;
            miembrosTableBody.appendChild(row);
        });
    }

    // --- Funciones de autenticación ---
    
    // Escucha los cambios de autenticación para saber si un usuario inicia o cierra sesión
    supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
            handleLogin(session);
        } else {
            handleLogout();
        }
    });

    async function handleLogin(session) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'block';
        manageGroupSection.style.display = 'block';
        document.querySelectorAll('.actions-header, .actions-cell').forEach(el => el.style.display = 'table-cell');

        const { data: userProfile, error } = await supabase
            .from('perfiles')
            .select('rol, id_grupo')
            .eq('id', session.user.id)
            .single();

        if (error) {
            console.error('Error al obtener el perfil del usuario:', error);
            return;
        }

        const puedeEditar = (userProfile.rol === 'lider' || userProfile.rol === 'decano' || userProfile.rol === 'admin');
        const idGrupo = (userProfile.rol !== 'admin') ? userProfile.id_grupo : null;
        
        // Renderizar la tabla del grupo si el usuario no es admin
        if (idGrupo) {
             await renderMiembrosDelGrupo(idGrupo, puedeEditar);
        }

        // Si el usuario es el líder principal (admin), puede gestionar todos los grupos
        if (userProfile.rol === 'admin') {
            console.log('Admin logeado. Acceso total a la gestión de grupos.');
            // Aquí podrías agregar lógica para que el admin pueda seleccionar un grupo para gestionar
        }
    }

    function handleLogout() {
        loginBtn.style.display = 'block';
        logoutBtn.style.display = 'none';
        manageGroupSection.style.display = 'none';
        document.querySelectorAll('.actions-header, .actions-cell').forEach(el => el.style.display = 'none');
        renderGrupos(); // Volver a la vista pública
    }
    
    // --- Lógica del botón de inicio de sesión (CORREGIDO) ---
    loginBtn.addEventListener('click', async () => {
        const email = prompt("Ingresa tu correo:");
        const password = prompt("Ingresa tu contraseña:");

        if (email && password) {
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                alert("Error al iniciar sesión: verifica tu correo y contraseña.");
                console.error(error);
            }
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
    });

    // --- Funciones de gestión de datos ---

    updateMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('member-name').value;
        const puntos = parseInt(document.getElementById('member-points').value);

        if (nombre && !isNaN(puntos)) {
            // Lógica para actualizar en Supabase
            const { error } = await supabase
                .from('miembros_del_clan')
                .update({ puntos: puntos })
                .eq('nombre', nombre);

            if (error) {
                alert('Error al actualizar: Es posible que no tengas permiso o que el nombre no exista.');
            } else {
                alert('Puntos actualizados con éxito.');
                // Recargar la tabla (CORREGIDO)
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    const { data: perfil } = await supabase.from('perfiles').select('id_grupo').eq('id', session.user.id).single();
                    if (perfil) {
                        await renderMiembrosDelGrupo(perfil.id_grupo, true);
                    }
                }
            }
            updateMemberForm.reset();
        }
    });

    // Iniciar la aplicación en modo público
    renderGrupos();
});