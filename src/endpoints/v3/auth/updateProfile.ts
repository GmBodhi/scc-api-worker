import { OpenAPIRoute } from "chanfana";
import {
  type AppContext,
  ErrorResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "../../../types";
import { requireAuth } from "../../../middleware/auth";

/**
 * PUT /api/v3/auth/profile
 * Update current user's profile
 */
export class UpdateProfile extends OpenAPIRoute {
  schema = {
    summary: "Update user profile",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateProfileRequest,
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Profile updated successfully",
        content: {
          "application/json": {
            schema: UpdateProfileResponse,
          },
        },
      },
      "400": {
        description: "Bad request - invalid data",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "401": {
        description: "Unauthorized - invalid or missing token",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
      "500": {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorResponse,
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    try {
      // Authenticate user
      const AuthContext = await requireAuth(c);

      const user = AuthContext?.user;

      if (!user) {
        return c.json(
          { success: false, error: "Invalid or expired token" },
          401,
        );
      }

      const data = await this.getValidatedData<typeof this.schema>();
      const { name, email, phone, profile_photo, profile_photo_filename } =
        data.body;

      // Build update fields
      const updates: string[] = [];
      const bindings: any[] = [];

      // Update name if provided
      if (name !== undefined && name.trim()) {
        updates.push("name = ?");
        bindings.push(name.trim());
      }

      // Update email if provided
      if (email !== undefined && email.trim()) {
        // Check if email already exists for another user
        const existingUser = await c.env.GENERAL_DB.prepare(
          "SELECT id FROM users WHERE email = ? AND id != ?",
        )
          .bind(email.trim(), user.id)
          .first();

        if (existingUser) {
          return c.json({ success: false, error: "Email already in use" }, 400);
        }

        updates.push("email = ?");
        bindings.push(email.trim());
      }

      // Update phone if provided
      if (phone !== undefined && phone.trim()) {
        updates.push("phone = ?");
        bindings.push(phone.trim());
      }

      // Handle profile photo update
      let photoUrl: string | null = null;
      if (profile_photo !== undefined) {
        if (profile_photo === null) {
          // Explicitly remove profile photo
          updates.push("profile_photo_url = ?");
          bindings.push(null);
        } else if (profile_photo.startsWith("data:image/")) {
          // Upload new base64 encoded image to R2
          if (c.env.PROFILE_PHOTOS) {
            try {
              // Extract base64 data and mime type
              const matches = profile_photo.match(
                /^data:image\/(\w+);base64,(.+)$/,
              );
              if (matches) {
                const [, imageType, base64Data] = matches;
                const imageBuffer = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0),
                );

                // Generate unique filename
                const extension = imageType.toLowerCase();
                const filename = profile_photo_filename
                  ? `${user.id}-${Date.now()}-${profile_photo_filename}`
                  : `${user.id}-${Date.now()}.${extension}`;
                const key = `profiles/${filename}`;

                // Delete old profile photo from R2 if it exists
                if (
                  user.profile_photo_url &&
                  user.profile_photo_url.includes(
                    "profile-photos.sctcoding.club",
                  )
                ) {
                  try {
                    const oldKey = user.profile_photo_url.split(
                      "profile-photos.sctcoding.club/",
                    )[1];
                    if (oldKey) {
                      await c.env.PROFILE_PHOTOS.delete(oldKey);
                    }
                  } catch (deleteError) {
                    console.error(
                      "Failed to delete old profile photo:",
                      deleteError,
                    );
                  }
                }

                // Upload to R2
                await c.env.PROFILE_PHOTOS.put(key, imageBuffer, {
                  httpMetadata: {
                    contentType: `image/${imageType}`,
                  },
                });

                // Construct public URL
                photoUrl = `https://profile-photos.sctcoding.club/${key}`;
                updates.push("profile_photo_url = ?");
                bindings.push(photoUrl);
              }
            } catch (uploadError) {
              console.error("R2 upload error:", uploadError);
              return c.json(
                { success: false, error: "Failed to upload profile photo" },
                500,
              );
            }
          }
        } else if (
          profile_photo.startsWith("http://") ||
          profile_photo.startsWith("https://")
        ) {
          // External URL
          photoUrl = profile_photo;
          updates.push("profile_photo_url = ?");
          bindings.push(photoUrl);
        }
      }

      // Check if there are any updates to make
      if (updates.length === 0) {
        return c.json(
          { success: false, error: "No valid fields to update" },
          400,
        );
      }

      // Add updated_at timestamp
      updates.push("updated_at = ?");
      bindings.push(Math.floor(Date.now() / 1000));

      // Add user ID for WHERE clause
      bindings.push(user.id);

      // Execute update
      await c.env.GENERAL_DB.prepare(
        `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
      )
        .bind(...bindings)
        .run();

      // Fetch updated user data
      const updatedUser = await c.env.GENERAL_DB.prepare(
        "SELECT * FROM users WHERE id = ?",
      )
        .bind(user.id)
        .first();

      if (!updatedUser) {
        return c.json(
          { success: false, error: "Failed to fetch updated user" },
          500,
        );
      }

      return c.json({
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          phone: updatedUser.phone || null,
          name: updatedUser.name,
          google_id: updatedUser.google_id || null,
          etlab_username: updatedUser.etlab_username || null,
          profile_photo_url: updatedUser.profile_photo_url || null,
          created_at: updatedUser.created_at || 0,
          is_verified: updatedUser.is_verified || false,
        },
        message: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Update profile error:", error);
      return c.json({ success: false, error: "Internal server error" }, 500);
    }
  }
}
