const AWS = require("aws-sdk");
const dotenv = require('dotenv');

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const ec2 = new AWS.EC2({
  region: 'us-east-1'
});

// const params = {
//   KeyName: 'forsc'
// }

// ec2.createKeyPair(params, function (err, data) {
//   if (err) {
//     console.log(err, err.stack)
//   } else {
//     console.log(data.KeyMaterial)
//   }
// })

let script = `#!/bin/bash
apt-get update -y
apt-get upgrade -y

touch /home/ubuntu/index.txt
mkdir /etc/chaindirect

curl -sSL https://chaindirect.s3.amazonaws.com/chaindirect.sh | bash -s supplier

`

ec2.runInstances({
  ImageId: 'ami-007855ac798b5175e',
  InstanceType: 't2.micro',
  KeyName: 'forsc',
  MaxCount: 1,
  MinCount: 1,
  UserData: Buffer.from(script).toString("base64"),
  NetworkInterfaces: [
    {
      DeviceIndex: 0,
      SubnetId: 'subnet-081abd700407550e4',
      AssociatePublicIpAddress: true
    }
  ]
}, function (err, data) {
  if (err) console.log(err, err.stack);


  let instanceId = data.Instances[0].InstanceId;

  console.log("instanceId", instanceId);

  ec2.waitFor("instanceRunning", { InstanceIds: [instanceId] }, function (err, data) {
    if (err) console.log("Error", err);

    ec2.allocateAddress(function (err, data) {
      if (err) console.log("Error", err);

      console.log("Elastic IP created");

      let IP = data.PublicIp;
      console.log("IP", IP);

      ec2.associateAddress({
        AllocationId: data.AllocationId,
        InstanceId: instanceId
      }, function (err, data) {

        console.log("Elastic IP associated to EC2");

        if (err) console.log("Err", err);
        else console.log("Success", data);

      })

    })

  });


})
