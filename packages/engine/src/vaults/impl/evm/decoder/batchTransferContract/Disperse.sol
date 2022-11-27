// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

interface IERC721_IERC1155 {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes calldata data
    ) external;
}

contract Disperse {
    function disperseNFT(
        address recipient,
        IERC721_IERC1155[] calldata tokens,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data
    ) external {
        for (uint256 index; index < tokenIds.length; index++) {
            if (amounts[index] > 0) {
                tokens[index].safeTransferFrom(
                    msg.sender,
                    recipient,
                    tokenIds[index],
                    amounts[index],
                    data
                );
            } else {
                tokens[index].safeTransferFrom(
                    msg.sender,
                    recipient,
                    tokenIds[index]
                );
            }
        }
    }

    function disperseEther(address[] memory recipients, uint256[] memory values)
        external
        payable
    {
        for (uint256 i = 0; i < recipients.length; i++)
            payable(recipients[i]).transfer(values[i]);
        uint256 balance = address(this).balance;
        if (balance > 0) payable(msg.sender).transfer(balance);
    }

    function disperseToken(
        IERC20 token,
        address[] memory recipients,
        uint256[] memory values
    ) external {
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++) total += values[i];
        require(token.transferFrom(msg.sender, address(this), total));
        for (uint256 i = 0; i < recipients.length; i++)
            require(token.transfer(recipients[i], values[i]));
    }

    function disperseTokenSimple(
        IERC20 token,
        address[] memory recipients,
        uint256[] memory values
    ) external {
        for (uint256 i = 0; i < recipients.length; i++)
            require(token.transferFrom(msg.sender, recipients[i], values[i]));
    }

    function disperseEtherSameValue(address[] memory recipients, uint256 value)
        external
        payable
    {
        for (uint256 i = 0; i < recipients.length; i++)
            payable(recipients[i]).transfer(value);
        uint256 balance = address(this).balance;
        if (balance > 0) payable(msg.sender).transfer(balance);
    }

    function disperseTokenSameValue(
        IERC20 token,
        address[] memory recipients,
        uint256 value
    ) external {
        uint256 total = value * recipients.length;
        require(token.transferFrom(msg.sender, address(this), total));
        for (uint256 i = 0; i < recipients.length; i++)
            require(token.transfer(recipients[i], value));
    }
}
