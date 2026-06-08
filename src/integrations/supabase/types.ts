export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          created_at: string | null
          file_path: string
          file_url: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_url: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_url?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cinematic_clip_versions: {
        Row: {
          clip_id: string
          created_at: string | null
          generation_id: string
          id: string
          is_active: boolean
          version_number: number
        }
        Insert: {
          clip_id: string
          created_at?: string | null
          generation_id: string
          id?: string
          is_active?: boolean
          version_number?: number
        }
        Update: {
          clip_id?: string
          created_at?: string | null
          generation_id?: string
          id?: string
          is_active?: boolean
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "cinematic_clip_versions_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "cinematic_clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinematic_clip_versions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
        ]
      }
      cinematic_clips: {
        Row: {
          created_at: string | null
          duration: string
          end_frame_url: string | null
          id: string
          project_id: string
          slot_index: number
          start_frame_url: string | null
          status: string
          transition_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: string
          end_frame_url?: string | null
          id?: string
          project_id: string
          slot_index: number
          start_frame_url?: string | null
          status?: string
          transition_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: string
          end_frame_url?: string | null
          id?: string
          project_id?: string
          slot_index?: number
          start_frame_url?: string | null
          status?: string
          transition_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cinematic_clips_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "cinematic_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinematic_clips_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "cinematic_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      cinematic_projects: {
        Row: {
          aspect_ratio: string
          created_at: string | null
          draft_state: Json | null
          id: string
          name: string
          status: string
          template_id: string | null
          updated_at: string | null
          user_id: string
          with_sound: boolean
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string | null
          draft_state?: Json | null
          id?: string
          name: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
          user_id: string
          with_sound?: boolean
        }
        Update: {
          aspect_ratio?: string
          created_at?: string | null
          draft_state?: Json | null
          id?: string
          name?: string
          status?: string
          template_id?: string | null
          updated_at?: string | null
          user_id?: string
          with_sound?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cinematic_projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cinematic_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cinematic_transitions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          prompt_text: string
          sort_order: number | null
          template_slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          prompt_text: string
          sort_order?: number | null
          template_slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          prompt_text?: string
          sort_order?: number | null
          template_slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cinematic_transitions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string | null
          credits: number
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price_ngn: number
          price_usd: number | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string | null
          credits: number
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price_ngn: number
          price_usd?: number | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string | null
          credits?: number
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price_ngn?: number
          price_usd?: number | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string | null
          description: string | null
          expires_at: string | null
          generation_id: string | null
          id: string
          is_test: boolean
          metadata: Json | null
          payment_amount_ngn: number | null
          payment_amount_usd: number | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          generation_id?: string | null
          id?: string
          is_test?: boolean
          metadata?: Json | null
          payment_amount_ngn?: number | null
          payment_amount_usd?: number | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          generation_id?: string | null
          id?: string
          is_test?: boolean
          metadata?: Json | null
          payment_amount_ngn?: number | null
          payment_amount_usd?: number | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          attachment_urls: Json | null
          body: string | null
          body_mode: string | null
          created_at: string | null
          created_by: string | null
          custom_user_ids: string[] | null
          error_message: string | null
          id: string
          recipient_count: number | null
          schedule: Json | null
          send_mode: string | null
          sent_at: string | null
          status: string | null
          subject: string
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          attachment_urls?: Json | null
          body?: string | null
          body_mode?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_user_ids?: string[] | null
          error_message?: string | null
          id?: string
          recipient_count?: number | null
          schedule?: Json | null
          send_mode?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          attachment_urls?: Json | null
          body?: string | null
          body_mode?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_user_ids?: string[] | null
          error_message?: string | null
          id?: string
          recipient_count?: number | null
          schedule?: Json | null
          send_mode?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feed_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          generation_id: string
          id: string
          likes_count: number | null
          output_type: string
          output_url: string | null
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["feed_status"] | null
          template_id: string | null
          thumbnail_url: string
          title: string | null
          updated_at: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          generation_id: string
          id?: string
          likes_count?: number | null
          output_type: string
          output_url?: string | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["feed_status"] | null
          template_id?: string | null
          thumbnail_url: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          generation_id?: string
          id?: string
          likes_count?: number | null
          output_type?: string
          output_url?: string | null
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["feed_status"] | null
          template_id?: string | null
          thumbnail_url?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_actors: {
        Row: {
          age_range: string | null
          body_reference_url: string | null
          created_at: string
          ethnic_background: string | null
          face_reference_url: string | null
          film_id: string
          gender: Database["public"]["Enums"]["filma_actor_gender"] | null
          id: string
          name: string
          nationality: string | null
          physique: Database["public"]["Enums"]["filma_physique"] | null
          role_description: string | null
          sort_order: number
          thumbnail_url: string | null
          ugc_profile_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_range?: string | null
          body_reference_url?: string | null
          created_at?: string
          ethnic_background?: string | null
          face_reference_url?: string | null
          film_id: string
          gender?: Database["public"]["Enums"]["filma_actor_gender"] | null
          id?: string
          name: string
          nationality?: string | null
          physique?: Database["public"]["Enums"]["filma_physique"] | null
          role_description?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          ugc_profile_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_range?: string | null
          body_reference_url?: string | null
          created_at?: string
          ethnic_background?: string | null
          face_reference_url?: string | null
          film_id?: string
          gender?: Database["public"]["Enums"]["filma_actor_gender"] | null
          id?: string
          name?: string
          nationality?: string | null
          physique?: Database["public"]["Enums"]["filma_physique"] | null
          role_description?: string | null
          sort_order?: number
          thumbnail_url?: string | null
          ugc_profile_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_actors_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_actors_ugc_profile_id_fkey"
            columns: ["ugc_profile_id"]
            isOneToOne: false
            referencedRelation: "ugc_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_actors_ugc_profile_id_fkey"
            columns: ["ugc_profile_id"]
            isOneToOne: false
            referencedRelation: "ugc_profiles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_actors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_dropdown_customs: {
        Row: {
          created_at: string
          field_name: string
          film_id: string | null
          id: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          field_name: string
          film_id?: string | null
          id?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          field_name?: string
          film_id?: string | null
          id?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_dropdown_customs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_dropdown_customs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_films: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["filma_aspect_ratio"]
          color_grading: Database["public"]["Enums"]["filma_color_grading"]
          color_grading_custom: string | null
          created_at: string
          film_type: Database["public"]["Enums"]["filma_film_type"]
          film_type_custom: string | null
          genre: Database["public"]["Enums"]["filma_genre"]
          genre_custom: string | null
          id: string
          setting: Database["public"]["Enums"]["filma_setting"]
          setting_custom: string | null
          status: Database["public"]["Enums"]["filma_film_status"]
          structure_type: Database["public"]["Enums"]["filma_structure_type"]
          title: string
          total_parts: number | null
          total_seasons: number | null
          updated_at: string
          user_id: string
          visual_style: Database["public"]["Enums"]["filma_visual_style"]
          visual_style_custom: string | null
        }
        Insert: {
          aspect_ratio?: Database["public"]["Enums"]["filma_aspect_ratio"]
          color_grading: Database["public"]["Enums"]["filma_color_grading"]
          color_grading_custom?: string | null
          created_at?: string
          film_type: Database["public"]["Enums"]["filma_film_type"]
          film_type_custom?: string | null
          genre: Database["public"]["Enums"]["filma_genre"]
          genre_custom?: string | null
          id?: string
          setting: Database["public"]["Enums"]["filma_setting"]
          setting_custom?: string | null
          status?: Database["public"]["Enums"]["filma_film_status"]
          structure_type?: Database["public"]["Enums"]["filma_structure_type"]
          title: string
          total_parts?: number | null
          total_seasons?: number | null
          updated_at?: string
          user_id: string
          visual_style: Database["public"]["Enums"]["filma_visual_style"]
          visual_style_custom?: string | null
        }
        Update: {
          aspect_ratio?: Database["public"]["Enums"]["filma_aspect_ratio"]
          color_grading?: Database["public"]["Enums"]["filma_color_grading"]
          color_grading_custom?: string | null
          created_at?: string
          film_type?: Database["public"]["Enums"]["filma_film_type"]
          film_type_custom?: string | null
          genre?: Database["public"]["Enums"]["filma_genre"]
          genre_custom?: string | null
          id?: string
          setting?: Database["public"]["Enums"]["filma_setting"]
          setting_custom?: string | null
          status?: Database["public"]["Enums"]["filma_film_status"]
          structure_type?: Database["public"]["Enums"]["filma_structure_type"]
          title?: string
          total_parts?: number | null
          total_seasons?: number | null
          updated_at?: string
          user_id?: string
          visual_style?: Database["public"]["Enums"]["filma_visual_style"]
          visual_style_custom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filma_films_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_parts: {
        Row: {
          created_at: string
          film_id: string
          id: string
          label: string
          part_number: number
          season_number: number | null
          total_scenes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          film_id: string
          id?: string
          label: string
          part_number: number
          season_number?: number | null
          total_scenes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          film_id?: string
          id?: string
          label?: string
          part_number?: number
          season_number?: number | null
          total_scenes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_parts_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_scene_actors: {
        Row: {
          actor_id: string
          film_id: string
          id: string
          outfit_image_url: string | null
          scene_id: string
        }
        Insert: {
          actor_id: string
          film_id: string
          id?: string
          outfit_image_url?: string | null
          scene_id: string
        }
        Update: {
          actor_id?: string
          film_id?: string
          id?: string
          outfit_image_url?: string | null
          scene_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_scene_actors_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "filma_actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_scene_actors_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_scene_actors_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "filma_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_scenes: {
        Row: {
          actor_ids: string[]
          created_at: string
          film_id: string
          id: string
          master_image_url: string | null
          part_id: string
          scaffolded: boolean
          scene_number: number
          script_text: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          actor_ids?: string[]
          created_at?: string
          film_id: string
          id?: string
          master_image_url?: string | null
          part_id: string
          scaffolded?: boolean
          scene_number: number
          script_text?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          actor_ids?: string[]
          created_at?: string
          film_id?: string
          id?: string
          master_image_url?: string | null
          part_id?: string
          scaffolded?: boolean
          scene_number?: number
          script_text?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_scenes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_scenes_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "filma_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_shot_refs: {
        Row: {
          created_at: string
          description: string
          film_id: string
          id: string
          image_url: string
          scene_id: string
          shot_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description: string
          film_id: string
          id?: string
          image_url: string
          scene_id: string
          shot_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          film_id?: string
          id?: string
          image_url?: string
          scene_id?: string
          shot_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "filma_shot_refs_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_shot_refs_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "filma_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_shot_refs_shot_id_fkey"
            columns: ["shot_id"]
            isOneToOne: false
            referencedRelation: "filma_shots"
            referencedColumns: ["id"]
          },
        ]
      }
      filma_shots: {
        Row: {
          actor_ids: string[]
          audio_duration_seconds: number | null
          audio_first_word: string | null
          audio_last_word: string | null
          audio_mode: Database["public"]["Enums"]["filma_audio_mode"]
          audio_url: string | null
          camera_note: string | null
          created_at: string
          description: string | null
          dialogue_text: string | null
          direction_note: string | null
          duration_seconds: number | null
          emotion_note: string | null
          end_frame_url: string | null
          film_id: string
          generation_id: string | null
          id: string
          output_thumbnail_url: string | null
          output_url: string | null
          scene_id: string
          shot_number: number
          shot_type: Database["public"]["Enums"]["filma_shot_type"]
          speaking_actor_id: string | null
          start_frame_url: string | null
          status: Database["public"]["Enums"]["filma_shot_status"]
          updated_at: string
        }
        Insert: {
          actor_ids?: string[]
          audio_duration_seconds?: number | null
          audio_first_word?: string | null
          audio_last_word?: string | null
          audio_mode?: Database["public"]["Enums"]["filma_audio_mode"]
          audio_url?: string | null
          camera_note?: string | null
          created_at?: string
          description?: string | null
          dialogue_text?: string | null
          direction_note?: string | null
          duration_seconds?: number | null
          emotion_note?: string | null
          end_frame_url?: string | null
          film_id: string
          generation_id?: string | null
          id?: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          scene_id: string
          shot_number: number
          shot_type?: Database["public"]["Enums"]["filma_shot_type"]
          speaking_actor_id?: string | null
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["filma_shot_status"]
          updated_at?: string
        }
        Update: {
          actor_ids?: string[]
          audio_duration_seconds?: number | null
          audio_first_word?: string | null
          audio_last_word?: string | null
          audio_mode?: Database["public"]["Enums"]["filma_audio_mode"]
          audio_url?: string | null
          camera_note?: string | null
          created_at?: string
          description?: string | null
          dialogue_text?: string | null
          direction_note?: string | null
          duration_seconds?: number | null
          emotion_note?: string | null
          end_frame_url?: string | null
          film_id?: string
          generation_id?: string | null
          id?: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          scene_id?: string
          shot_number?: number
          shot_type?: Database["public"]["Enums"]["filma_shot_type"]
          speaking_actor_id?: string | null
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["filma_shot_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "filma_shots_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "filma_films"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_shots_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_shots_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "filma_scenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filma_shots_speaking_actor_id_fkey"
            columns: ["speaking_actor_id"]
            isOneToOne: false
            referencedRelation: "filma_actors"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["aspect_ratio"] | null
          body_consent_confirmed: boolean | null
          created_at: string | null
          credits_charged: number
          duration: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url: string | null
          enhanced_prompt: string | null
          error_message: string | null
          generation_metadata: Json | null
          generation_time_ms: number | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id: string
          input_image_urls: string[] | null
          is_published: boolean | null
          is_smart_edit: boolean
          is_staff_generation: boolean | null
          model: string | null
          novice_accumulated_days: number
          original_prompt: string | null
          output_thumbnail_url: string | null
          output_type: string | null
          output_url: string | null
          pool_user_id: string | null
          prompt: string | null
          prompt_engineering_used: boolean | null
          provider_request_id: string | null
          refinement_mode: string | null
          resolution: string | null
          skip_prompt_refinement: boolean
          start_frame_url: string | null
          status: Database["public"]["Enums"]["generation_status"] | null
          storage_protected_at: string | null
          template_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          vision_analysis_used: boolean | null
          with_sound: boolean
        }
        Insert: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          body_consent_confirmed?: boolean | null
          created_at?: string | null
          credits_charged?: number
          duration?: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url?: string | null
          enhanced_prompt?: string | null
          error_message?: string | null
          generation_metadata?: Json | null
          generation_time_ms?: number | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id?: string
          input_image_urls?: string[] | null
          is_published?: boolean | null
          is_smart_edit?: boolean
          is_staff_generation?: boolean | null
          model?: string | null
          novice_accumulated_days?: number
          original_prompt?: string | null
          output_thumbnail_url?: string | null
          output_type?: string | null
          output_url?: string | null
          pool_user_id?: string | null
          prompt?: string | null
          prompt_engineering_used?: boolean | null
          provider_request_id?: string | null
          refinement_mode?: string | null
          resolution?: string | null
          skip_prompt_refinement?: boolean
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          storage_protected_at?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          vision_analysis_used?: boolean | null
          with_sound?: boolean
        }
        Update: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          body_consent_confirmed?: boolean | null
          created_at?: string | null
          credits_charged?: number
          duration?: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url?: string | null
          enhanced_prompt?: string | null
          error_message?: string | null
          generation_metadata?: Json | null
          generation_time_ms?: number | null
          generation_type?: Database["public"]["Enums"]["generation_type"]
          id?: string
          input_image_urls?: string[] | null
          is_published?: boolean | null
          is_smart_edit?: boolean
          is_staff_generation?: boolean | null
          model?: string | null
          novice_accumulated_days?: number
          original_prompt?: string | null
          output_thumbnail_url?: string | null
          output_type?: string | null
          output_url?: string | null
          pool_user_id?: string | null
          prompt?: string | null
          prompt_engineering_used?: boolean | null
          provider_request_id?: string | null
          refinement_mode?: string | null
          resolution?: string | null
          skip_prompt_refinement?: boolean
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          storage_protected_at?: string | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          vision_analysis_used?: boolean | null
          with_sound?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_generations_model"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "model_usage_stats"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "fk_generations_model"
            columns: ["model"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["value"]
          },
          {
            foreignKeyName: "generations_pool_user_id_fkey"
            columns: ["pool_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          aka: string | null
          created_at: string | null
          credit_cost_i2i: number
          credit_cost_per_second: number | null
          credit_cost_resolution: Json | null
          credit_cost_t2i: number
          credit_multiplier: number
          description: string | null
          feature: string
          id: string
          is_active: boolean | null
          is_flat_rate: boolean
          is_locked: boolean | null
          is_user_facing: boolean
          is_verified: boolean
          label: string
          max_ref_images: number
          min_billable_seconds: number | null
          provider: string
          requires_audio: boolean
          requires_image: boolean
          requires_video: boolean
          requires_voice_id: boolean
          sort_order: number | null
          sound_cost_multiplier: number
          sublabel: string | null
          supported_aspect_ratios: string[] | null
          supported_durations: string[] | null
          supports_end_frame: boolean
          supports_frame_to_frame: boolean
          supports_image: boolean
          supports_multi_image: boolean
          supports_sound: boolean
          supports_start_frame: boolean
          supports_text_script: boolean
          supports_video_input: boolean
          tier_required: Database["public"]["Enums"]["model_tier"]
          type: string
          updated_at: string | null
          value: string
        }
        Insert: {
          aka?: string | null
          created_at?: string | null
          credit_cost_i2i?: number
          credit_cost_per_second?: number | null
          credit_cost_resolution?: Json | null
          credit_cost_t2i?: number
          credit_multiplier?: number
          description?: string | null
          feature?: string
          id?: string
          is_active?: boolean | null
          is_flat_rate?: boolean
          is_locked?: boolean | null
          is_user_facing?: boolean
          is_verified?: boolean
          label: string
          max_ref_images?: number
          min_billable_seconds?: number | null
          provider?: string
          requires_audio?: boolean
          requires_image?: boolean
          requires_video?: boolean
          requires_voice_id?: boolean
          sort_order?: number | null
          sound_cost_multiplier?: number
          sublabel?: string | null
          supported_aspect_ratios?: string[] | null
          supported_durations?: string[] | null
          supports_end_frame?: boolean
          supports_frame_to_frame?: boolean
          supports_image?: boolean
          supports_multi_image?: boolean
          supports_sound?: boolean
          supports_start_frame?: boolean
          supports_text_script?: boolean
          supports_video_input?: boolean
          tier_required?: Database["public"]["Enums"]["model_tier"]
          type: string
          updated_at?: string | null
          value: string
        }
        Update: {
          aka?: string | null
          created_at?: string | null
          credit_cost_i2i?: number
          credit_cost_per_second?: number | null
          credit_cost_resolution?: Json | null
          credit_cost_t2i?: number
          credit_multiplier?: number
          description?: string | null
          feature?: string
          id?: string
          is_active?: boolean | null
          is_flat_rate?: boolean
          is_locked?: boolean | null
          is_user_facing?: boolean
          is_verified?: boolean
          label?: string
          max_ref_images?: number
          min_billable_seconds?: number | null
          provider?: string
          requires_audio?: boolean
          requires_image?: boolean
          requires_video?: boolean
          requires_voice_id?: boolean
          sort_order?: number | null
          sound_cost_multiplier?: number
          sublabel?: string | null
          supported_aspect_ratios?: string[] | null
          supported_durations?: string[] | null
          supports_end_frame?: boolean
          supports_frame_to_frame?: boolean
          supports_image?: boolean
          supports_multi_image?: boolean
          supports_sound?: boolean
          supports_start_frame?: boolean
          supports_text_script?: boolean
          supports_video_input?: boolean
          tier_required?: Database["public"]["Enums"]["model_tier"]
          type?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_prompt_refinement: boolean
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          creator_type: string | null
          credits: number | null
          display_name: string | null
          id: string
          is_banned: boolean | null
          is_staff: boolean | null
          last_seen_at: string | null
          onboarding_completed: boolean | null
          preferred_aspect_ratio:
            | Database["public"]["Enums"]["aspect_ratio"]
            | null
          preferred_duration:
            | Database["public"]["Enums"]["video_duration"]
            | null
          preferred_model: string | null
          primary_use_case: string | null
          purchase_count: number
          referral_code: string | null
          referral_source: string | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          staff_note: string | null
          staff_since: string | null
          subscription_count: number | null
          team_role: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          tier_expires_at: string | null
          tier_started_at: string | null
          total_credits_purchased: number | null
          total_credits_used: number | null
          total_generations: number | null
          updated_at: string | null
          user_tier: string
          username: string
        }
        Insert: {
          ai_prompt_refinement?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          creator_type?: string | null
          credits?: number | null
          display_name?: string | null
          id: string
          is_banned?: boolean | null
          is_staff?: boolean | null
          last_seen_at?: string | null
          onboarding_completed?: boolean | null
          preferred_aspect_ratio?:
            | Database["public"]["Enums"]["aspect_ratio"]
            | null
          preferred_duration?:
            | Database["public"]["Enums"]["video_duration"]
            | null
          preferred_model?: string | null
          primary_use_case?: string | null
          purchase_count?: number
          referral_code?: string | null
          referral_source?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          staff_note?: string | null
          staff_since?: string | null
          subscription_count?: number | null
          team_role?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          tier_expires_at?: string | null
          tier_started_at?: string | null
          total_credits_purchased?: number | null
          total_credits_used?: number | null
          total_generations?: number | null
          updated_at?: string | null
          user_tier?: string
          username: string
        }
        Update: {
          ai_prompt_refinement?: boolean
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          creator_type?: string | null
          credits?: number | null
          display_name?: string | null
          id?: string
          is_banned?: boolean | null
          is_staff?: boolean | null
          last_seen_at?: string | null
          onboarding_completed?: boolean | null
          preferred_aspect_ratio?:
            | Database["public"]["Enums"]["aspect_ratio"]
            | null
          preferred_duration?:
            | Database["public"]["Enums"]["video_duration"]
            | null
          preferred_model?: string | null
          primary_use_case?: string | null
          purchase_count?: number
          referral_code?: string | null
          referral_source?: string | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          staff_note?: string | null
          staff_since?: string | null
          subscription_count?: number | null
          team_role?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          tier_expires_at?: string | null
          tier_started_at?: string | null
          total_credits_purchased?: number | null
          total_credits_used?: number | null
          total_generations?: number | null
          updated_at?: string | null
          user_tier?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          first_purchase_bonus_paid: boolean
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          total_commission_credits: number
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          first_purchase_bonus_paid?: boolean
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          total_commission_credits?: number
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          first_purchase_bonus_paid?: boolean
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          total_commission_credits?: number
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_activity: {
        Row: {
          created_at: string | null
          credits_used: number
          generation_id: string
          id: string
          staff_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_used?: number
          generation_id: string
          id?: string
          staff_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_used?: number
          generation_id?: string
          id?: string
          staff_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_activity_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_activity_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_activity_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_assets: {
        Row: {
          asset_key: string
          created_at: string | null
          file_name: string
          file_type: string
          id: string
          public_url: string
          storage_path: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          asset_key: string
          created_at?: string | null
          file_name: string
          file_type: string
          id?: string
          public_url: string
          storage_path: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          asset_key?: string
          created_at?: string | null
          file_name?: string
          file_type?: string
          id?: string
          public_url?: string
          storage_path?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_assets_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_prompts: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          prompt_text: string
          template_id: string
          version_number: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          prompt_text: string
          template_id: string
          version_number?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          prompt_text?: string
          template_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_prompts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: Database["public"]["Enums"]["template_category"]
          created_at: string | null
          credit_cost: number
          credit_cost_per_image: number | null
          default_model: string | null
          demo_video_url: string | null
          description: string | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id: string
          instructions: string | null
          is_active: boolean | null
          is_featured: boolean | null
          max_images: number | null
          min_images: number | null
          name: string
          prompt_key: string
          slug: string
          sort_order: number | null
          supports_aspect_ratio: boolean | null
          supports_duration: boolean | null
          supports_model_selection: boolean | null
          thumbnail_url: string | null
          updated_at: string | null
          usage_count: number | null
          visibility: Database["public"]["Enums"]["template_visibility"]
        }
        Insert: {
          category: Database["public"]["Enums"]["template_category"]
          created_at?: string | null
          credit_cost?: number
          credit_cost_per_image?: number | null
          default_model?: string | null
          demo_video_url?: string | null
          description?: string | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          max_images?: number | null
          min_images?: number | null
          name: string
          prompt_key: string
          slug: string
          sort_order?: number | null
          supports_aspect_ratio?: boolean | null
          supports_duration?: boolean | null
          supports_model_selection?: boolean | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          visibility?: Database["public"]["Enums"]["template_visibility"]
        }
        Update: {
          category?: Database["public"]["Enums"]["template_category"]
          created_at?: string | null
          credit_cost?: number
          credit_cost_per_image?: number | null
          default_model?: string | null
          demo_video_url?: string | null
          description?: string | null
          generation_type?: Database["public"]["Enums"]["generation_type"]
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          max_images?: number | null
          min_images?: number | null
          name?: string
          prompt_key?: string
          slug?: string
          sort_order?: number | null
          supports_aspect_ratio?: boolean | null
          supports_duration?: boolean | null
          supports_model_selection?: boolean | null
          thumbnail_url?: string | null
          updated_at?: string | null
          usage_count?: number | null
          visibility?: Database["public"]["Enums"]["template_visibility"]
        }
        Relationships: []
      }
      ugc_audio_chunks: {
        Row: {
          chunk_index: number
          created_at: string | null
          duration_ms: number | null
          file_size_bytes: number | null
          generation_id: string
          id: string
          label: string
          public_url: string
          status: string
          storage_path: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          created_at?: string | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          generation_id: string
          id?: string
          label: string
          public_url: string
          status?: string
          storage_path: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          created_at?: string | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          generation_id?: string
          id?: string
          label?: string
          public_url?: string
          status?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_audio_chunks_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "ugc_audio_generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_audio_chunks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_audio_generations: {
        Row: {
          character_count: number
          chunk_count: number
          created_at: string | null
          credits_charged: number
          duration_seconds: number | null
          elevenlabs_voice_id: string
          error_message: string | null
          id: string
          model_id: string
          output_url: string | null
          refined_script: string | null
          script: string
          similarity_boost: number
          stability: number
          status: Database["public"]["Enums"]["audio_gen_status"]
          style: number
          updated_at: string | null
          user_id: string
          voice_id: string
        }
        Insert: {
          character_count?: number
          chunk_count?: number
          created_at?: string | null
          credits_charged?: number
          duration_seconds?: number | null
          elevenlabs_voice_id: string
          error_message?: string | null
          id?: string
          model_id?: string
          output_url?: string | null
          refined_script?: string | null
          script: string
          similarity_boost?: number
          stability?: number
          status?: Database["public"]["Enums"]["audio_gen_status"]
          style?: number
          updated_at?: string | null
          user_id: string
          voice_id: string
        }
        Update: {
          character_count?: number
          chunk_count?: number
          created_at?: string | null
          credits_charged?: number
          duration_seconds?: number | null
          elevenlabs_voice_id?: string
          error_message?: string | null
          id?: string
          model_id?: string
          output_url?: string | null
          refined_script?: string | null
          script?: string
          similarity_boost?: number
          stability?: number
          status?: Database["public"]["Enums"]["audio_gen_status"]
          style?: number
          updated_at?: string | null
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_audio_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_audio_generations_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "ugc_voices"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_brand_generations: {
        Row: {
          aspect_ratio: string
          created_at: string
          generation_id: string
          id: string
          output_type: string
          refined_prompt: string | null
          scene_prompt: string
          ugc_brand_id: string
          user_id: string
          with_sound: boolean
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string
          generation_id: string
          id?: string
          output_type: string
          refined_prompt?: string | null
          scene_prompt?: string
          ugc_brand_id: string
          user_id: string
          with_sound?: boolean
        }
        Update: {
          aspect_ratio?: string
          created_at?: string
          generation_id?: string
          id?: string
          output_type?: string
          refined_prompt?: string | null
          scene_prompt?: string
          ugc_brand_id?: string
          user_id?: string
          with_sound?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ugc_brand_generations_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_brand_generations_ugc_brand_id_fkey"
            columns: ["ugc_brand_id"]
            isOneToOne: false
            referencedRelation: "ugc_brand_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_brand_profiles: {
        Row: {
          brand_bio: string | null
          brand_colors: string[]
          brand_name: string
          brand_tones: string[]
          competitor_brands: string | null
          content_styles: string[]
          country: string
          created_at: string
          generation_count: number
          id: string
          industry: Database["public"]["Enums"]["ugc_brand_industry"] | null
          logo_url: string | null
          offering_type:
            | Database["public"]["Enums"]["ugc_brand_offering_type"]
            | null
          offerings: string[]
          platforms: string[]
          price_tier: Database["public"]["Enums"]["ugc_brand_price_tier"] | null
          status: Database["public"]["Enums"]["ugc_status"]
          tagline: string
          target_age_ranges: string[]
          target_genders: string[]
          target_interests: string | null
          target_markets: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          visual_styles: string[]
          website: string | null
        }
        Insert: {
          brand_bio?: string | null
          brand_colors?: string[]
          brand_name: string
          brand_tones?: string[]
          competitor_brands?: string | null
          content_styles?: string[]
          country: string
          created_at?: string
          generation_count?: number
          id?: string
          industry?: Database["public"]["Enums"]["ugc_brand_industry"] | null
          logo_url?: string | null
          offering_type?:
            | Database["public"]["Enums"]["ugc_brand_offering_type"]
            | null
          offerings?: string[]
          platforms?: string[]
          price_tier?:
            | Database["public"]["Enums"]["ugc_brand_price_tier"]
            | null
          status?: Database["public"]["Enums"]["ugc_status"]
          tagline: string
          target_age_ranges?: string[]
          target_genders?: string[]
          target_interests?: string | null
          target_markets?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          visual_styles?: string[]
          website?: string | null
        }
        Update: {
          brand_bio?: string | null
          brand_colors?: string[]
          brand_name?: string
          brand_tones?: string[]
          competitor_brands?: string | null
          content_styles?: string[]
          country?: string
          created_at?: string
          generation_count?: number
          id?: string
          industry?: Database["public"]["Enums"]["ugc_brand_industry"] | null
          logo_url?: string | null
          offering_type?:
            | Database["public"]["Enums"]["ugc_brand_offering_type"]
            | null
          offerings?: string[]
          platforms?: string[]
          price_tier?:
            | Database["public"]["Enums"]["ugc_brand_price_tier"]
            | null
          status?: Database["public"]["Enums"]["ugc_status"]
          tagline?: string
          target_age_ranges?: string[]
          target_genders?: string[]
          target_interests?: string | null
          target_markets?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          visual_styles?: string[]
          website?: string | null
        }
        Relationships: []
      }
      ugc_generations: {
        Row: {
          aspect_ratio: string
          created_at: string | null
          filter_applied: Database["public"]["Enums"]["ugc_generation_filter"]
          generation_id: string
          id: string
          output_type: string
          refined_prompt: string | null
          scene_prompt: string
          selected_photos: string[]
          ugc_profile_id: string
          user_id: string
        }
        Insert: {
          aspect_ratio?: string
          created_at?: string | null
          filter_applied?: Database["public"]["Enums"]["ugc_generation_filter"]
          generation_id: string
          id?: string
          output_type: string
          refined_prompt?: string | null
          scene_prompt: string
          selected_photos?: string[]
          ugc_profile_id: string
          user_id: string
        }
        Update: {
          aspect_ratio?: string
          created_at?: string | null
          filter_applied?: Database["public"]["Enums"]["ugc_generation_filter"]
          generation_id?: string
          id?: string
          output_type?: string
          refined_prompt?: string | null
          scene_prompt?: string
          selected_photos?: string[]
          ugc_profile_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_generations_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "generations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_generations_ugc_profile_id_fkey"
            columns: ["ugc_profile_id"]
            isOneToOne: false
            referencedRelation: "ugc_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_generations_ugc_profile_id_fkey"
            columns: ["ugc_profile_id"]
            isOneToOne: false
            referencedRelation: "ugc_profiles_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ugc_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_profiles: {
        Row: {
          age: number
          backstory: string
          content_energy: string[]
          created_at: string | null
          education_level:
            | Database["public"]["Enums"]["ugc_education_level"]
            | null
          ethnic_background: string
          fashion_score: number
          gender: Database["public"]["Enums"]["ugc_gender"] | null
          generation_count: number
          id: string
          interests: string
          last_used_at: string | null
          name: string
          nationality: string
          occupation: string
          photo_body_back: string | null
          photo_body_front: string | null
          photo_body_side: string | null
          photo_face_front: string | null
          photo_face_side_90: string | null
          photo_face_three_quarter: string | null
          platforms: string[]
          socioeconomic_status:
            | Database["public"]["Enums"]["ugc_socioeconomic_status"]
            | null
          status: Database["public"]["Enums"]["ugc_profile_status"]
          style_direction: string
          thumbnail_url: string | null
          updated_at: string | null
          user_id: string
          vibe_tags: string[]
        }
        Insert: {
          age: number
          backstory: string
          content_energy?: string[]
          created_at?: string | null
          education_level?:
            | Database["public"]["Enums"]["ugc_education_level"]
            | null
          ethnic_background: string
          fashion_score: number
          gender?: Database["public"]["Enums"]["ugc_gender"] | null
          generation_count?: number
          id?: string
          interests: string
          last_used_at?: string | null
          name: string
          nationality: string
          occupation: string
          photo_body_back?: string | null
          photo_body_front?: string | null
          photo_body_side?: string | null
          photo_face_front?: string | null
          photo_face_side_90?: string | null
          photo_face_three_quarter?: string | null
          platforms?: string[]
          socioeconomic_status?:
            | Database["public"]["Enums"]["ugc_socioeconomic_status"]
            | null
          status?: Database["public"]["Enums"]["ugc_profile_status"]
          style_direction: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id: string
          vibe_tags?: string[]
        }
        Update: {
          age?: number
          backstory?: string
          content_energy?: string[]
          created_at?: string | null
          education_level?:
            | Database["public"]["Enums"]["ugc_education_level"]
            | null
          ethnic_background?: string
          fashion_score?: number
          gender?: Database["public"]["Enums"]["ugc_gender"] | null
          generation_count?: number
          id?: string
          interests?: string
          last_used_at?: string | null
          name?: string
          nationality?: string
          occupation?: string
          photo_body_back?: string | null
          photo_body_front?: string | null
          photo_body_side?: string | null
          photo_face_front?: string | null
          photo_face_side_90?: string | null
          photo_face_three_quarter?: string | null
          platforms?: string[]
          socioeconomic_status?:
            | Database["public"]["Enums"]["ugc_socioeconomic_status"]
            | null
          status?: Database["public"]["Enums"]["ugc_profile_status"]
          style_direction?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          user_id?: string
          vibe_tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ugc_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_voices: {
        Row: {
          created_at: string | null
          description: string | null
          elevenlabs_voice_id: string
          generation_count: number
          id: string
          labels: Json | null
          last_used_at: string | null
          name: string
          preview_url: string | null
          source: Database["public"]["Enums"]["ugc_voice_source"]
          status: Database["public"]["Enums"]["ugc_voice_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          elevenlabs_voice_id: string
          generation_count?: number
          id?: string
          labels?: Json | null
          last_used_at?: string | null
          name: string
          preview_url?: string | null
          source?: Database["public"]["Enums"]["ugc_voice_source"]
          status?: Database["public"]["Enums"]["ugc_voice_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          elevenlabs_voice_id?: string
          generation_count?: number
          id?: string
          labels?: Json | null
          last_used_at?: string | null
          name?: string
          preview_url?: string | null
          source?: Database["public"]["Enums"]["ugc_voice_source"]
          status?: Database["public"]["Enums"]["ugc_voice_status"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ugc_voices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      model_usage_stats: {
        Row: {
          aka: string | null
          avg_credits_per_gen: number | null
          avg_generation_time_ms: number | null
          credit_cost_i2i: number | null
          credit_cost_t2i: number | null
          estimated_revenue_usd: number | null
          failed_gens: number | null
          feature: string | null
          gens_last_30d: number | null
          gens_last_7d: number | null
          is_active: boolean | null
          label: string | null
          last_used_at: string | null
          successful_gens: number | null
          total_credits_consumed: number | null
          total_gens: number | null
          type: string | null
          unique_users: number | null
          value: string | null
        }
        Relationships: []
      }
      referral_stats: {
        Row: {
          converted_referrals: number | null
          pending_referrals: number | null
          referral_code: string | null
          total_commission_earned: number | null
          total_referrals: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ugc_profiles_summary: {
        Row: {
          age: number | null
          created_at: string | null
          gender: Database["public"]["Enums"]["ugc_gender"] | null
          generation_count: number | null
          id: string | null
          last_used_at: string | null
          name: string | null
          nationality: string | null
          status: Database["public"]["Enums"]["ugc_profile_status"] | null
          thumbnail_url: string | null
          total_generations: number | null
          user_id: string | null
          vibe_tags: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ugc_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_amount_ngn: number
          p_amount_usd: number
          p_bonus_amount: number
          p_description: string
          p_payment_provider: string
          p_payment_reference: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_adjust_credits: {
        Args: {
          p_admin_id: string
          p_amount: number
          p_note?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_get_user_email: { Args: { p_user_id: string }; Returns: string }
      admin_grant_credits: {
        Args: {
          p_admin_id: string
          p_amount: number
          p_description?: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_referral: {
        Args: { p_referral_code: string; p_referred_user_id: string }
        Returns: Json
      }
      approve_feed_post: {
        Args: { p_admin_id: string; p_notes?: string; p_post_id: string }
        Returns: Json
      }
      award_referral_commission: {
        Args: {
          p_buyer_user_id: string
          p_credits_bought: number
          p_transaction_id: string
        }
        Returns: undefined
      }
      deduct_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_generation_id: string
          p_user_id: string
        }
        Returns: Json
      }
      deduct_staff_pool: {
        Args: {
          p_amount: number
          p_generation_id: string
          p_staff_id: string
          p_template_id?: string
        }
        Returns: Json
      }
      demote_from_staff: {
        Args: { p_admin_id: string; p_user_id: string }
        Returns: Json
      }
      filma_push_end_frame: { Args: { p_shot_id: string }; Returns: Json }
      filma_scaffold_scene: {
        Args: { p_scene_id: string; p_shots: Json }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      get_active_prompt: { Args: { p_template_slug: string }; Returns: string }
      get_admin_stats: { Args: never; Returns: Json }
      get_app_setting: { Args: { p_key: string }; Returns: string }
      get_staff_summary: {
        Args: never
        Returns: {
          credits_used: number
          display_name: string
          gens_today: number
          staff_id: string
          staff_note: string
          staff_since: string
          total_gens: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_template_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
      promote_to_staff: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: Json
      }
      refund_credits: {
        Args: {
          p_amount: number
          p_description?: string
          p_generation_id: string
          p_user_id: string
        }
        Returns: Json
      }
      reject_feed_post: {
        Args: { p_admin_id: string; p_notes?: string; p_post_id: string }
        Returns: Json
      }
      remove_feed_post: {
        Args: { p_admin_id: string; p_post_id: string }
        Returns: Json
      }
      rollback_prompt_version: {
        Args: { p_admin_id: string; p_prompt_id: string }
        Returns: Json
      }
      run_novice_storage_cleanup: { Args: never; Returns: undefined }
      save_prompt_version: {
        Args: {
          p_admin_id: string
          p_notes?: string
          p_prompt_text: string
          p_template_id: string
        }
        Returns: Json
      }
      toggle_feed_like: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: Json
      }
      toggle_template_visibility: {
        Args: { p_admin_id: string; p_template_id: string }
        Returns: Json
      }
      update_model_pricing: {
        Args: { p_cost_i2i: number; p_cost_t2i: number; p_model_value: string }
        Returns: Json
      }
    }
    Enums: {
      ai_model:
        | "kling_2_5"
        | "seedance_1_5"
        | "imagen_3"
        | "auto"
        | "flux_dev_ultra_fast"
        | "flux_dev"
        | "flux_schnell"
        | "seedream_v4_5"
        | "nano_banana_pro"
        | "imagen_4"
        | "gpt_image_2"
        | "grok_imagine"
        | "wan_2_7"
        | "z_image_turbo"
        | "z_image_base"
        | "ernie_image_turbo"
        | "half_moon_face_swap"
        | "face_swap"
        | "head_swap"
        | "kling_v3_pro"
        | "kling_v3_std"
        | "kling_v2_6_pro"
        | "veo3_1_fast"
        | "veo3_1_lite"
        | "seedance_2_fast"
        | "seedance_1_5_pro"
        | "wan_2_6"
        | "wan_2_5"
        | "hailuo_02_pro"
        | "pixverse_v6"
      app_role: "admin" | "moderator" | "staff" | "user"
      aspect_ratio: "9:16" | "16:9" | "1:1" | "auto"
      audio_gen_status: "pending" | "processing" | "completed" | "failed"
      feed_status: "pending" | "approved" | "rejected" | "published"
      filma_actor_gender: "male" | "female" | "non_binary" | "other"
      filma_aspect_ratio: "9:16" | "16:9" | "1:1" | "4:3" | "21:9"
      filma_audio_mode: "ai_voice" | "uploaded"
      filma_color_grading:
        | "teal_and_orange"
        | "hollywood_blockbuster"
        | "netflix_dark"
        | "bleach_bypass"
        | "warm_cinematic"
        | "cold_thriller"
        | "nollywood_vibrant"
        | "high_contrast_drama"
        | "desaturated_indie"
        | "kodak_film_emulation"
        | "fuji_film_emulation"
        | "blue_hour_moody"
        | "green_cast_tension"
        | "earthy_natural"
        | "airy_and_soft"
        | "other"
      filma_film_status: "draft" | "in_production" | "completed"
      filma_film_type:
        | "feature_film"
        | "short_film"
        | "epic"
        | "mini_series"
        | "series"
        | "documentary"
        | "anthology"
        | "web_series"
        | "other"
      filma_genre:
        | "action"
        | "adventure"
        | "comedy"
        | "crime"
        | "drama"
        | "fantasy"
        | "horror"
        | "musical"
        | "mystery"
        | "romance"
        | "sci_fi"
        | "thriller"
        | "western"
        | "war"
        | "historical"
        | "animation"
        | "film_noir"
        | "supernatural"
        | "biographical"
        | "sports"
        | "other"
      filma_physique:
        | "slim"
        | "athletic"
        | "average"
        | "muscular"
        | "plus_size"
        | "petite"
      filma_setting:
        | "contemporary"
        | "historical"
        | "futuristic"
        | "period_drama"
        | "post_apocalyptic"
        | "fantasy_world"
        | "alternate_reality"
        | "other"
      filma_shot_status:
        | "pending"
        | "ready"
        | "generating"
        | "completed"
        | "failed"
      filma_shot_type:
        | "establishing"
        | "wide"
        | "medium"
        | "close_up"
        | "extreme_close_up"
        | "over_the_shoulder"
        | "point_of_view"
        | "aerial"
        | "two_shot"
        | "insert"
        | "action"
        | "dialogue"
        | "reaction"
        | "transition"
        | "montage"
        | "other"
      filma_structure_type: "single" | "multi_part" | "series"
      filma_visual_style:
        | "cinematic"
        | "handheld_documentary"
        | "noir"
        | "avant_garde"
        | "neorealism"
        | "surrealist"
        | "other"
      generation_status: "pending" | "processing" | "completed" | "failed"
      generation_type:
        | "text_to_image"
        | "image_to_image"
        | "text_to_video"
        | "image_to_video"
        | "start_end_frame"
        | "end_frame_text"
        | "template"
        | "motion_transfer"
        | "lipsync"
      model_tier: "free" | "master"
      payment_provider: "paystack" | "google" | "admin"
      subscription_tier: "free" | "starter" | "pro" | "enterprise"
      template_category:
        | "handover"
        | "memory_lane"
        | "motion"
        | "lipsync"
        | "custom"
        | "transform"
      template_visibility: "promptiq" | "public"
      transaction_status: "pending" | "completed" | "failed"
      transaction_type:
        | "purchase"
        | "usage"
        | "refund"
        | "bonus"
        | "admin_grant"
        | "staff_usage"
        | "referral_commission"
        | "referral_bonus"
      ugc_brand_industry:
        | "fashion"
        | "beauty"
        | "food_beverage"
        | "health_wellness"
        | "tech"
        | "finance"
        | "real_estate"
        | "entertainment"
        | "education"
        | "ecommerce"
        | "automotive"
        | "travel"
        | "sports"
        | "nonprofit"
        | "other"
      ugc_brand_offering_type: "products" | "services" | "both"
      ugc_brand_price_tier: "budget" | "mid" | "premium" | "luxury"
      ugc_education_level:
        | "no_formal_education"
        | "primary_school"
        | "secondary_school"
        | "vocational_training"
        | "some_college"
        | "bachelors_degree"
        | "masters_degree"
        | "phd_or_doctorate"
        | "self_taught"
      ugc_gender:
        | "male"
        | "female"
        | "non_binary"
        | "other"
        | "prefer_not_to_say"
      ugc_generation_filter: "hyper_realistic" | "cinematic"
      ugc_profile_status: "draft" | "active" | "archived"
      ugc_socioeconomic_status:
        | "struggling"
        | "working_class"
        | "comfortable"
        | "wealthy"
        | "elite"
      ugc_status: "draft" | "active" | "archived"
      ugc_voice_source:
        | "elevenlabs_library"
        | "instant_clone"
        | "professional_clone"
      ugc_voice_status: "active" | "archived"
      user_role: "user" | "staff" | "admin"
      video_duration: "5" | "8" | "10" | "15"
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
  public: {
    Enums: {
      ai_model: [
        "kling_2_5",
        "seedance_1_5",
        "imagen_3",
        "auto",
        "flux_dev_ultra_fast",
        "flux_dev",
        "flux_schnell",
        "seedream_v4_5",
        "nano_banana_pro",
        "imagen_4",
        "gpt_image_2",
        "grok_imagine",
        "wan_2_7",
        "z_image_turbo",
        "z_image_base",
        "ernie_image_turbo",
        "half_moon_face_swap",
        "face_swap",
        "head_swap",
        "kling_v3_pro",
        "kling_v3_std",
        "kling_v2_6_pro",
        "veo3_1_fast",
        "veo3_1_lite",
        "seedance_2_fast",
        "seedance_1_5_pro",
        "wan_2_6",
        "wan_2_5",
        "hailuo_02_pro",
        "pixverse_v6",
      ],
      app_role: ["admin", "moderator", "staff", "user"],
      aspect_ratio: ["9:16", "16:9", "1:1", "auto"],
      audio_gen_status: ["pending", "processing", "completed", "failed"],
      feed_status: ["pending", "approved", "rejected", "published"],
      filma_actor_gender: ["male", "female", "non_binary", "other"],
      filma_aspect_ratio: ["9:16", "16:9", "1:1", "4:3", "21:9"],
      filma_audio_mode: ["ai_voice", "uploaded"],
      filma_color_grading: [
        "teal_and_orange",
        "hollywood_blockbuster",
        "netflix_dark",
        "bleach_bypass",
        "warm_cinematic",
        "cold_thriller",
        "nollywood_vibrant",
        "high_contrast_drama",
        "desaturated_indie",
        "kodak_film_emulation",
        "fuji_film_emulation",
        "blue_hour_moody",
        "green_cast_tension",
        "earthy_natural",
        "airy_and_soft",
        "other",
      ],
      filma_film_status: ["draft", "in_production", "completed"],
      filma_film_type: [
        "feature_film",
        "short_film",
        "epic",
        "mini_series",
        "series",
        "documentary",
        "anthology",
        "web_series",
        "other",
      ],
      filma_genre: [
        "action",
        "adventure",
        "comedy",
        "crime",
        "drama",
        "fantasy",
        "horror",
        "musical",
        "mystery",
        "romance",
        "sci_fi",
        "thriller",
        "western",
        "war",
        "historical",
        "animation",
        "film_noir",
        "supernatural",
        "biographical",
        "sports",
        "other",
      ],
      filma_physique: [
        "slim",
        "athletic",
        "average",
        "muscular",
        "plus_size",
        "petite",
      ],
      filma_setting: [
        "contemporary",
        "historical",
        "futuristic",
        "period_drama",
        "post_apocalyptic",
        "fantasy_world",
        "alternate_reality",
        "other",
      ],
      filma_shot_status: [
        "pending",
        "ready",
        "generating",
        "completed",
        "failed",
      ],
      filma_shot_type: [
        "establishing",
        "wide",
        "medium",
        "close_up",
        "extreme_close_up",
        "over_the_shoulder",
        "point_of_view",
        "aerial",
        "two_shot",
        "insert",
        "action",
        "dialogue",
        "reaction",
        "transition",
        "montage",
        "other",
      ],
      filma_structure_type: ["single", "multi_part", "series"],
      filma_visual_style: [
        "cinematic",
        "handheld_documentary",
        "noir",
        "avant_garde",
        "neorealism",
        "surrealist",
        "other",
      ],
      generation_status: ["pending", "processing", "completed", "failed"],
      generation_type: [
        "text_to_image",
        "image_to_image",
        "text_to_video",
        "image_to_video",
        "start_end_frame",
        "end_frame_text",
        "template",
        "motion_transfer",
        "lipsync",
      ],
      model_tier: ["free", "master"],
      payment_provider: ["paystack", "google", "admin"],
      subscription_tier: ["free", "starter", "pro", "enterprise"],
      template_category: [
        "handover",
        "memory_lane",
        "motion",
        "lipsync",
        "custom",
        "transform",
      ],
      template_visibility: ["promptiq", "public"],
      transaction_status: ["pending", "completed", "failed"],
      transaction_type: [
        "purchase",
        "usage",
        "refund",
        "bonus",
        "admin_grant",
        "staff_usage",
        "referral_commission",
        "referral_bonus",
      ],
      ugc_brand_industry: [
        "fashion",
        "beauty",
        "food_beverage",
        "health_wellness",
        "tech",
        "finance",
        "real_estate",
        "entertainment",
        "education",
        "ecommerce",
        "automotive",
        "travel",
        "sports",
        "nonprofit",
        "other",
      ],
      ugc_brand_offering_type: ["products", "services", "both"],
      ugc_brand_price_tier: ["budget", "mid", "premium", "luxury"],
      ugc_education_level: [
        "no_formal_education",
        "primary_school",
        "secondary_school",
        "vocational_training",
        "some_college",
        "bachelors_degree",
        "masters_degree",
        "phd_or_doctorate",
        "self_taught",
      ],
      ugc_gender: [
        "male",
        "female",
        "non_binary",
        "other",
        "prefer_not_to_say",
      ],
      ugc_generation_filter: ["hyper_realistic", "cinematic"],
      ugc_profile_status: ["draft", "active", "archived"],
      ugc_socioeconomic_status: [
        "struggling",
        "working_class",
        "comfortable",
        "wealthy",
        "elite",
      ],
      ugc_status: ["draft", "active", "archived"],
      ugc_voice_source: [
        "elevenlabs_library",
        "instant_clone",
        "professional_clone",
      ],
      ugc_voice_status: ["active", "archived"],
      user_role: ["user", "staff", "admin"],
      video_duration: ["5", "8", "10", "15"],
    },
  },
} as const
