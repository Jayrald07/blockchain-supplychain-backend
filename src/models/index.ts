import mongoose, { Schema } from "mongoose";

const organization = new Schema({
    organization_username: String,
    organization_password: String,
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' }
});

const organization_details = new Schema({
    organization_details_id: String,
    organization_type_id: { type: Schema.Types.ObjectId, ref: 'OrganizationType' },
    organization_name: String,
    organization_address: String,
    organization_phone: String
})

const organization_type = new Schema({
    organization_type_id: Schema.Types.ObjectId,
    organization_type_name: String
})

const organization_ou = new Schema({
    organization_ou_id: String,
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' }
})

const organization_asset = new Schema({
    organization_asset_id: String,
    organization_details_id: { type: Schema.Types.ObjectId, ref: 'OrganizationDetails' },
    asset_id: [{ type: Schema.Types.ObjectId, ref: 'Asset' }]
})

const asset = new Schema({
    asset_id: String,
    asset_name: String,
    asset_uuid: String,
    tag_code: String
})

const tag = new Schema({
    tag_id: String,
    tag_key: String,
    tag_value: String,
    tag_code: String
})

const Organization = mongoose.model('Organization', organization);
const OrganizationType = mongoose.model('OrganizationType', organization_type);
const OrganizationDetails = mongoose.model('OrganizationDetails', organization_details);
const OrganizationOU = mongoose.model('OrganizationOU', organization_ou);
const OrganizationAsset = mongoose.model('OrganizationAsset', organization_asset);
const Asset = mongoose.model('Asset', asset);
const Tag = mongoose.model('Tag', tag);

export default {
    Organization,
    OrganizationType,
    OrganizationDetails,
    OrganizationOU,
    OrganizationAsset,
    Asset,
    Tag
}