export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admins: {
        Row: {
          activo: boolean
          ciudad_id: string
          creado_en: string
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          activo?: boolean
          ciudad_id: string
          creado_en?: string
          id: string
          nombre?: string
          rol: string
        }
        Update: {
          activo?: boolean
          ciudad_id?: string
          creado_en?: string
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora: {
        Row: {
          accion: string
          admin_id: string | null
          ciudad_id: string
          creada_en: string
          detalle: Json
          entidad: string
          entidad_id: string | null
          id: string
        }
        Insert: {
          accion: string
          admin_id?: string | null
          ciudad_id: string
          creada_en?: string
          detalle?: Json
          entidad: string
          entidad_id?: string | null
          id?: string
        }
        Update: {
          accion?: string
          admin_id?: string | null
          ciudad_id?: string
          creada_en?: string
          detalle?: Json
          entidad?: string
          entidad_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          activa: boolean
          ciudad_id: string
          color: string
          icono: string
          id: string
          nombre: string
          orden: number
          slug: string
        }
        Insert: {
          activa?: boolean
          ciudad_id: string
          color?: string
          icono?: string
          id?: string
          nombre: string
          orden?: number
          slug: string
        }
        Update: {
          activa?: boolean
          ciudad_id?: string
          color?: string
          icono?: string
          id?: string
          nombre?: string
          orden?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      ciudadelas: {
        Row: {
          activa: boolean
          ciudad_id: string
          creada_en: string
          enlace_canal: string | null
          fuente: string | null
          id: string
          nombre: string
          orden: number
          poblacion_estimada: number | null
          slug: string
          verificado: boolean
          zona: string
        }
        Insert: {
          activa?: boolean
          ciudad_id: string
          creada_en?: string
          enlace_canal?: string | null
          fuente?: string | null
          id?: string
          nombre: string
          orden?: number
          poblacion_estimada?: number | null
          slug: string
          verificado?: boolean
          zona?: string
        }
        Update: {
          activa?: boolean
          ciudad_id?: string
          creada_en?: string
          enlace_canal?: string | null
          fuente?: string | null
          id?: string
          nombre?: string
          orden?: number
          poblacion_estimada?: number | null
          slug?: string
          verificado?: boolean
          zona?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciudadelas_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      ciudades: {
        Row: {
          activa: boolean
          creada_en: string
          id: string
          modo: string
          nombre: string
          poblacion_urbana: number | null
          provincia: string
          slug: string
        }
        Insert: {
          activa?: boolean
          creada_en?: string
          id?: string
          modo?: string
          nombre: string
          poblacion_urbana?: number | null
          provincia: string
          slug: string
        }
        Update: {
          activa?: boolean
          creada_en?: string
          id?: string
          modo?: string
          nombre?: string
          poblacion_urbana?: number | null
          provincia?: string
          slug?: string
        }
        Relationships: []
      }
      estados: {
        Row: {
          activo: boolean
          ciudad_id: string
          color: string
          descripcion: string
          es_cierre_suave: boolean
          es_compromiso: boolean
          es_inicial: boolean
          id: string
          nombre: string
          orden: number
          slug: string
        }
        Insert: {
          activo?: boolean
          ciudad_id: string
          color?: string
          descripcion?: string
          es_cierre_suave?: boolean
          es_compromiso?: boolean
          es_inicial?: boolean
          id?: string
          nombre: string
          orden?: number
          slug: string
        }
        Update: {
          activo?: boolean
          ciudad_id?: string
          color?: string
          descripcion?: string
          es_cierre_suave?: boolean
          es_compromiso?: boolean
          es_inicial?: boolean
          id?: string
          nombre?: string
          orden?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "estados_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          actualizada_en: string
          apoyos: number
          aprobada: boolean
          aprobada_en: string | null
          aprobada_por: string | null
          audio_url: string | null
          categoria_id: string
          ciudad_id: string
          ciudadela_id: string
          codigo: string | null
          creada_en: string
          creador_id: string | null
          descripcion: string
          estado_id: string
          foto_url: string | null
          fuente: string | null
          fusionada_en: string | null
          ia_estado: string
          id: string
          motivo_rechazo: string | null
          origen: string
          rechazada_en: string | null
          texto_original: string | null
          titulo: string | null
          transcripcion: string | null
        }
        Insert: {
          actualizada_en?: string
          apoyos?: number
          aprobada?: boolean
          aprobada_en?: string | null
          aprobada_por?: string | null
          audio_url?: string | null
          categoria_id: string
          ciudad_id: string
          ciudadela_id: string
          codigo?: string | null
          creada_en?: string
          creador_id?: string | null
          descripcion?: string
          estado_id: string
          foto_url?: string | null
          fuente?: string | null
          fusionada_en?: string | null
          ia_estado?: string
          id?: string
          motivo_rechazo?: string | null
          origen?: string
          rechazada_en?: string | null
          texto_original?: string | null
          titulo?: string | null
          transcripcion?: string | null
        }
        Update: {
          actualizada_en?: string
          apoyos?: number
          aprobada?: boolean
          aprobada_en?: string | null
          aprobada_por?: string | null
          audio_url?: string | null
          categoria_id?: string
          ciudad_id?: string
          ciudadela_id?: string
          codigo?: string | null
          creada_en?: string
          creador_id?: string | null
          descripcion?: string
          estado_id?: string
          foto_url?: string | null
          fuente?: string | null
          fusionada_en?: string | null
          ia_estado?: string
          id?: string
          motivo_rechazo?: string | null
          origen?: string
          rechazada_en?: string | null
          texto_original?: string | null
          titulo?: string | null
          transcripcion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_aprobada_por_fkey"
            columns: ["aprobada_por"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_ciudadela_id_fkey"
            columns: ["ciudadela_id"]
            isOneToOne: false
            referencedRelation: "ciudadelas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "vecinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_fusionada_en_fkey"
            columns: ["fusionada_en"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          bio: string
          cargo: string
          cedula: string | null
          ciudad_id: string
          correo: string | null
          creado_en: string
          es_candidato: boolean
          foto_url: string | null
          id: string
          nombre: string
          orden: number
          redes: Json
          slug: string
          telefono: string | null
        }
        Insert: {
          activo?: boolean
          bio?: string
          cargo?: string
          cedula?: string | null
          ciudad_id: string
          correo?: string | null
          creado_en?: string
          es_candidato?: boolean
          foto_url?: string | null
          id?: string
          nombre: string
          orden?: number
          redes?: Json
          slug: string
          telefono?: string | null
        }
        Update: {
          activo?: boolean
          bio?: string
          cargo?: string
          cedula?: string | null
          ciudad_id?: string
          correo?: string | null
          creado_en?: string
          es_candidato?: boolean
          foto_url?: string | null
          id?: string
          nombre?: string
          orden?: number
          redes?: Json
          slug?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      portal: {
        Row: {
          actualizado_en: string
          banner_url: string | null
          bio: string
          candidato_cargo: string
          candidato_nombre: string
          cedula: string | null
          ciudad_id: string
          color_marca: string
          eslogan: string
          foto_hero_url: string | null
          foto_url: string | null
          hero_medio: string
          hero_subtitulo: string
          logo_url: string | null
          partido: string
          redes: Json
          video_portada_url: string | null
          video_url: string | null
          whatsapp_contacto: string | null
        }
        Insert: {
          actualizado_en?: string
          banner_url?: string | null
          bio?: string
          candidato_cargo?: string
          candidato_nombre?: string
          cedula?: string | null
          ciudad_id: string
          color_marca?: string
          eslogan?: string
          foto_hero_url?: string | null
          foto_url?: string | null
          hero_medio?: string
          hero_subtitulo?: string
          logo_url?: string | null
          partido?: string
          redes?: Json
          video_portada_url?: string | null
          video_url?: string | null
          whatsapp_contacto?: string | null
        }
        Update: {
          actualizado_en?: string
          banner_url?: string | null
          bio?: string
          candidato_cargo?: string
          candidato_nombre?: string
          cedula?: string | null
          ciudad_id?: string
          color_marca?: string
          eslogan?: string
          foto_hero_url?: string | null
          foto_url?: string | null
          hero_medio?: string
          hero_subtitulo?: string
          logo_url?: string | null
          partido?: string
          redes?: Json
          video_portada_url?: string | null
          video_url?: string | null
          whatsapp_contacto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: true
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      publicaciones: {
        Row: {
          autor_id: string | null
          ciudad_id: string
          creada_en: string
          estado_anterior_id: string | null
          estado_id: string | null
          id: string
          media: Json
          obra_id: string | null
          texto: string
        }
        Insert: {
          autor_id?: string | null
          ciudad_id: string
          creada_en?: string
          estado_anterior_id?: string | null
          estado_id?: string | null
          id?: string
          media?: Json
          obra_id?: string | null
          texto?: string
        }
        Update: {
          autor_id?: string | null
          ciudad_id?: string
          creada_en?: string
          estado_anterior_id?: string | null
          estado_id?: string | null
          id?: string
          media?: Json
          obra_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "publicaciones_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_estado_anterior_id_fkey"
            columns: ["estado_anterior_id"]
            isOneToOne: false
            referencedRelation: "estados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_estado_id_fkey"
            columns: ["estado_id"]
            isOneToOne: false
            referencedRelation: "estados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publicaciones_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      vecinos: {
        Row: {
          ciudad_id: string
          ciudadela_id: string | null
          creado_en: string
          id: string
          origen: string
          quiere_canal: boolean
          telefono: string | null
          ultimo_acceso_en: string
        }
        Insert: {
          ciudad_id: string
          ciudadela_id?: string | null
          creado_en?: string
          id: string
          origen?: string
          quiere_canal?: boolean
          telefono?: string | null
          ultimo_acceso_en?: string
        }
        Update: {
          ciudad_id?: string
          ciudadela_id?: string | null
          creado_en?: string
          id?: string
          origen?: string
          quiere_canal?: boolean
          telefono?: string | null
          ultimo_acceso_en?: string
        }
        Relationships: [
          {
            foreignKeyName: "vecinos_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vecinos_ciudadela_id_fkey"
            columns: ["ciudadela_id"]
            isOneToOne: false
            referencedRelation: "ciudadelas"
            referencedColumns: ["id"]
          },
        ]
      }
      votos: {
        Row: {
          ciudad_id: string
          creado_en: string
          id: string
          obra_id: string
          vecino_id: string
        }
        Insert: {
          ciudad_id: string
          creado_en?: string
          id?: string
          obra_id: string
          vecino_id: string
        }
        Update: {
          ciudad_id?: string
          creado_en?: string
          id?: string
          obra_id?: string
          vecino_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votos_ciudad_id_fkey"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votos_vecino_id_fkey"
            columns: ["vecino_id"]
            isOneToOne: false
            referencedRelation: "vecinos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_canales_guardar: {
        Args: { p_canales: Json; p_ciudad_id: string }
        Returns: Json
      }
      admin_canales_listar: { Args: { p_ciudad_id: string }; Returns: Json }
      admin_cola_aprobacion: { Args: { p_ciudad_id: string }; Returns: Json }
      admin_contactos_sector: {
        Args: { p_ciudadela_id: string; p_solo_canal?: boolean }
        Returns: Json
      }
      admin_estados_guardar: {
        Args: { p_ciudad_id: string; p_estados: Json }
        Returns: Json
      }
      admin_obra_aprobar: {
        Args: {
          p_categoria_id?: string
          p_descripcion?: string
          p_obra_id: string
          p_titulo?: string
        }
        Returns: Json
      }
      admin_obra_cambiar_estado: {
        Args: {
          p_estado_id: string
          p_media?: Json
          p_obra_id: string
          p_texto?: string
        }
        Returns: Json
      }
      admin_obra_crear: {
        Args: {
          p_categoria_id: string
          p_ciudadela_id: string
          p_descripcion?: string
          p_foto_url?: string
          p_fuente?: string
          p_titulo: string
        }
        Returns: Json
      }
      admin_obra_rechazar: {
        Args: { p_motivo: string; p_obra_id: string }
        Returns: Json
      }
      admin_obras_fusionar: {
        Args: { p_destino_id: string; p_origen_ids: string[] }
        Returns: Json
      }
      admin_obras_parecidas: { Args: { p_obra_id: string }; Returns: Json }
      admin_perfiles_guardar: {
        Args: { p_ciudad_id: string; p_perfiles: Json }
        Returns: Json
      }
      admin_perfiles_listar: { Args: { p_ciudad_id: string }; Returns: Json }
      admin_portal_guardar: {
        Args: { p_ciudad_id: string; p_datos: Json }
        Returns: Json
      }
      admin_ranking: {
        Args: { p_categoria_id?: string; p_ciudad_id: string }
        Returns: Json
      }
      admin_tablero: {
        Args: {
          p_categoria_id?: string
          p_ciudad_id: string
          p_ciudadela_id?: string
        }
        Returns: Json
      }
      anotar_bitacora: {
        Args: {
          p_accion: string
          p_ciudad_id: string
          p_detalle?: Json
          p_entidad: string
          p_entidad_id: string
        }
        Returns: undefined
      }
      ciudad_del_vecino: { Args: never; Returns: string }
      ciudad_portada: { Args: { p_ciudad_slug: string }; Returns: Json }
      ciudadela_del_vecino: { Args: never; Returns: string }
      es_admin: { Args: { p_ciudad_id: string }; Returns: boolean }
      es_del_equipo: { Args: { p_ciudad_id: string }; Returns: boolean }
      fn_search_norm: { Args: { p_texto: string }; Returns: string }
      generar_codigo_obra: { Args: never; Returns: string }
      normalizar_telefono: { Args: { p_telefono: string }; Returns: string }
      obra_apoyar: { Args: { p_obra_id: string }; Returns: Json }
      obra_crear: {
        Args: {
          p_audio_url?: string
          p_categoria_id: string
          p_ciudadela_id: string
          p_foto_url?: string
          p_texto?: string
        }
        Returns: Json
      }
      obra_detalle: {
        Args: { p_codigo?: string; p_obra_id?: string }
        Returns: Json
      }
      obra_ia_resultado: {
        Args: {
          p_descripcion: string
          p_fallo?: boolean
          p_obra_id: string
          p_titulo: string
          p_transcripcion?: string
        }
        Returns: Json
      }
      obra_quitar_apoyo: { Args: { p_obra_id: string }; Returns: Json }
      obras_listar: {
        Args: {
          p_busqueda?: string
          p_categoria_id?: string
          p_ciudad_slug: string
          p_ciudadela_id?: string
          p_desde?: number
          p_estado_id?: string
          p_limite?: number
          p_orden?: string
        }
        Returns: Json
      }
      portal_perfil: {
        Args: { p_ciudad_slug: string; p_slug: string }
        Returns: Json
      }
      portal_perfiles: { Args: { p_ciudad_slug: string }; Returns: Json }
      puede_editar: { Args: { p_ciudad_id: string }; Returns: boolean }
      ranking_ciudadela: {
        Args: { p_ciudadela_id: string; p_limite?: number }
        Returns: Json
      }
      rol_admin_en: { Args: { p_ciudad_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugificar: { Args: { p_texto: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      vecino_asegurar_interno: {
        Args: { p_ciudad_id: string; p_origen?: string }
        Returns: undefined
      }
      vecino_elegir_ciudadela: {
        Args: { p_ciudadela_id: string }
        Returns: Json
      }
      vecino_guardar_contacto: {
        Args: {
          p_ciudad_slug: string
          p_ciudadela_id?: string
          p_origen?: string
          p_quiere_canal?: boolean
          p_telefono: string
        }
        Returns: Json
      }
      vecino_yo: { Args: never; Returns: Json }
      vecinos_en_ciudadela: {
        Args: { p_ciudadela_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

