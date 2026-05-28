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
      generations: {
        Row: {
          aspect_ratio: Database["public"]["Enums"]["aspect_ratio"] | null
          created_at: string | null
          credits_charged: number
          duration: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url: string | null
          enhanced_prompt: string | null
          error_message: string | null
          fal_request_id: string | null
          generation_time_ms: number | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id: string
          input_image_urls: string[] | null
          is_published: boolean | null
          is_staff_generation: boolean | null
          model: Database["public"]["Enums"]["ai_model"] | null
          output_thumbnail_url: string | null
          output_type: string | null
          output_url: string | null
          pool_user_id: string | null
          prompt: string | null
          skip_prompt_refinement: boolean
          start_frame_url: string | null
          status: Database["public"]["Enums"]["generation_status"] | null
          template_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          with_sound: boolean
        }
        Insert: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          created_at?: string | null
          credits_charged?: number
          duration?: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url?: string | null
          enhanced_prompt?: string | null
          error_message?: string | null
          fal_request_id?: string | null
          generation_time_ms?: number | null
          generation_type: Database["public"]["Enums"]["generation_type"]
          id?: string
          input_image_urls?: string[] | null
          is_published?: boolean | null
          is_staff_generation?: boolean | null
          model?: Database["public"]["Enums"]["ai_model"] | null
          output_thumbnail_url?: string | null
          output_type?: string | null
          output_url?: string | null
          pool_user_id?: string | null
          prompt?: string | null
          skip_prompt_refinement?: boolean
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          with_sound?: boolean
        }
        Update: {
          aspect_ratio?: Database["public"]["Enums"]["aspect_ratio"] | null
          created_at?: string | null
          credits_charged?: number
          duration?: Database["public"]["Enums"]["video_duration"] | null
          end_frame_url?: string | null
          enhanced_prompt?: string | null
          error_message?: string | null
          fal_request_id?: string | null
          generation_time_ms?: number | null
          generation_type?: Database["public"]["Enums"]["generation_type"]
          id?: string
          input_image_urls?: string[] | null
          is_published?: boolean | null
          is_staff_generation?: boolean | null
          model?: Database["public"]["Enums"]["ai_model"] | null
          output_thumbnail_url?: string | null
          output_type?: string | null
          output_url?: string | null
          pool_user_id?: string | null
          prompt?: string | null
          skip_prompt_refinement?: boolean
          start_frame_url?: string | null
          status?: Database["public"]["Enums"]["generation_status"] | null
          template_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          with_sound?: boolean
        }
        Relationships: [
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
          created_at: string | null
          credit_cost_i2i: number
          credit_cost_t2i: number
          credit_multiplier: number
          id: string
          is_active: boolean | null
          is_locked: boolean | null
          label: string
          sort_order: number | null
          sound_cost_multiplier: number
          sublabel: string | null
          supports_image: boolean
          supports_sound: boolean
          type: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          credit_cost_i2i?: number
          credit_cost_t2i?: number
          credit_multiplier?: number
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          label: string
          sort_order?: number | null
          sound_cost_multiplier?: number
          sublabel?: string | null
          supports_image?: boolean
          supports_sound?: boolean
          type: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          credit_cost_i2i?: number
          credit_cost_t2i?: number
          credit_multiplier?: number
          id?: string
          is_active?: boolean | null
          is_locked?: boolean | null
          label?: string
          sort_order?: number | null
          sound_cost_multiplier?: number
          sublabel?: string | null
          supports_image?: boolean
          supports_sound?: boolean
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
          preferred_model: Database["public"]["Enums"]["ai_model"] | null
          primary_use_case: string | null
          referral_source: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          staff_note: string | null
          staff_since: string | null
          subscription_count: number | null
          team_role: string | null
          tier: Database["public"]["Enums"]["subscription_tier"] | null
          total_credits_purchased: number | null
          total_credits_used: number | null
          total_generations: number | null
          updated_at: string | null
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
          preferred_model?: Database["public"]["Enums"]["ai_model"] | null
          primary_use_case?: string | null
          referral_source?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          staff_note?: string | null
          staff_since?: string | null
          subscription_count?: number | null
          team_role?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          total_credits_purchased?: number | null
          total_credits_used?: number | null
          total_generations?: number | null
          updated_at?: string | null
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
          preferred_model?: Database["public"]["Enums"]["ai_model"] | null
          primary_use_case?: string | null
          referral_source?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          staff_note?: string | null
          staff_since?: string | null
          subscription_count?: number | null
          team_role?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"] | null
          total_credits_purchased?: number | null
          total_credits_used?: number | null
          total_generations?: number | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          p_amount: number
          p_amount_ngn?: number
          p_amount_usd?: number
          p_bonus_amount?: number
          p_description?: string
          p_payment_provider?: Database["public"]["Enums"]["payment_provider"]
          p_payment_reference?: string
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
      admin_grant_credits: {
        Args: {
          p_admin_id: string
          p_amount: number
          p_description?: string
          p_user_id: string
        }
        Returns: Json
      }
      approve_feed_post: {
        Args: { p_admin_id: string; p_notes?: string; p_post_id: string }
        Returns: Json
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
      feed_status: "pending" | "approved" | "rejected" | "published"
      generation_status: "pending" | "processing" | "completed" | "failed"
      generation_type:
        | "text_to_image"
        | "image_to_image"
        | "text_to_video"
        | "image_to_video"
        | "start_end_frame"
        | "end_frame_text"
        | "template"
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
      feed_status: ["pending", "approved", "rejected", "published"],
      generation_status: ["pending", "processing", "completed", "failed"],
      generation_type: [
        "text_to_image",
        "image_to_image",
        "text_to_video",
        "image_to_video",
        "start_end_frame",
        "end_frame_text",
        "template",
      ],
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
      ],
      user_role: ["user", "staff", "admin"],
      video_duration: ["5", "8", "10", "15"],
    },
  },
} as const
