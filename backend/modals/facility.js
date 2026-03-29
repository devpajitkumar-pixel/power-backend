import mongoose from "mongoose";

const facilitySchema = new mongoose.Schema(
  {
    owner_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    client_representative: {
      type: String,
      trim: true,
    },

    client_contact_number: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Please enter a valid phone number"],
    },

    client_email: {
      type: String,
      trim: true,
      match: [/.+\@.+\..+/, "Please enter a valid email"],
    },

    facility_type: {
      type: String,
      enum: ["hospital", "hotel", "factory", "office", "mall", "other"],
      default: "other",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // 🔍 Audit metadata (recommended)
    audit_date: {
      type: Date,
      default: Date.now,
    },

    auditor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    closure_date: {
      type: Date,
    },

    // 📂 Documents (Images / PDFs)
    documents: [
      {
        fileUrl: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          enum: ["image", "pdf"],
          required: true,
        },
        fileName: {
          type: String,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// 🔍 Indexes
facilitySchema.index({ owner_user_id: 1 });
facilitySchema.index({ created_by: 1 });
facilitySchema.index({ city: 1 });

const Facility = mongoose.model("Facility", facilitySchema);

export default Facility;
