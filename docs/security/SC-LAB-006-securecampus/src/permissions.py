def _profesor_del_grupo_con_alumno(user,student_id,group_id,con):
    return con.execute(
        'SELECT 1 FROM groups g JOIN enrollments e ON e.group_id=g.id '
        'WHERE g.id=? AND g.professor_id=? AND e.student_id=?',
        (group_id,user['id'],student_id)).fetchone() is not None

def puede_modificar(user,student_id,group_id,con):
    # Solo profesor asignado al grupo Y estudiante inscrito en él.
    if user['role']!='profesor': return False
    return _profesor_del_grupo_con_alumno(user,student_id,group_id,con)

def puede_consultar(user,student_id,group_id,con):
    # Estudiante propio e inscrito, o profesor asignado al grupo con estudiante inscrito.
    if user['role']=='estudiante':
        if user['id']!=student_id: return False
        return con.execute('SELECT 1 FROM enrollments WHERE student_id=? AND group_id=?',(student_id,group_id)).fetchone() is not None
    if user['role']=='profesor':
        return _profesor_del_grupo_con_alumno(user,student_id,group_id,con)
    return False
